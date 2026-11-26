import {
  getChemoGuidanceMeta,
  getConditionMeta,
  profileToNutritionInput,
} from '../data/conditions';
import { STOCK_LEVEL_META } from '../data/sampleInventory';
import { calculateDailyTargets, formatDailyTarget } from '../nutrition/calculator';
import { NUTRIENT_META, type NutrientKey } from '../nutrition/referenceData';
import type {
  DishIngredientInput,
  FlyerEntry,
  InventoryItem,
  PrepMethodTag,
  SuggestedMeal,
  UserProfile,
} from '../types';
import { calculateDishNutrition } from './nutritionCalculator';

interface GeminiMealRaw {
  title?: string;
  subtitle?: string;
  category?: string;
  cookTimeMin?: number;
  /** 安全のきまり4：AIには栄養数値を作らせず、食材名・1人分グラム数・下処理タグのみ返させる */
  ingredientsPerServing?: {
    name?: string;
    grams?: number;
    prepTags?: string[];
  }[];
  availableIngredients?: { name: string; amount: string }[];
  missingIngredients?: { name: string; amount: string }[];
  steps?: string[];
  careTips?: { label: string; tip: string }[];
  cookingFormTags?: string[];
  matchReason?: string;
}

interface GeminiFlyerRaw {
  storeName?: string;
  items?: {
    name?: string;
    priceText?: string;
    note?: string;
  }[];
}

const DEFAULT_FALLBACK_MODELS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-pro-latest',
] as const;

const EXCLUDED_MODEL_KEYWORDS = [
  'embedding',
  'aqa',
  'imagen',
  'veo',
  'tts',
  'audio',
  'image',
  'robotics',
  'computer-use',
  'deep-research',
  'live',
  'nano',
];

const RETRY_DELAYS_MS = [1500, 3000] as const;
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

interface GeminiGenerateResponse {
  candidates?: {
    content?: {
      parts?: { text?: string; thought?: boolean }[];
    };
  }[];
}

interface GeminiListModelsResponse {
  models?: {
    name?: string;
    supportedGenerationMethods?: string[];
  }[];
}

const modelCacheByKey = new Map<string, { fetchedAt: number; models: string[] }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function scoreGeminiModel(modelId: string): number {
  const id = modelId.toLowerCase();
  let score = 0;

  if (/^gemini-3(\.\d+)?-flash/.test(id)) score += 1000;
  else if (/^gemini-3(\.\d+)?-pro/.test(id)) score += 940;
  else if (/^gemini-3/.test(id)) score += 900;
  else if (id === 'gemini-2.5-flash') score += 860;
  else if (/^gemini-2\.5-flash-lite/.test(id)) score += 840;
  else if (/^gemini-2\.5-flash/.test(id)) score += 830;
  else if (id === 'gemini-2.5-pro') score += 800;
  else if (/^gemini-2\.5-pro/.test(id)) score += 780;
  else if (id === 'gemini-flash-latest') score += 760;
  else if (id === 'gemini-flash-lite-latest') score += 740;
  else if (id === 'gemini-pro-latest') score += 720;
  else if (/^gemini-2/.test(id)) score += 600;
  else score += 400;

  if (id.includes('flash') && !id.includes('lite')) score += 20;
  if (id.includes('exp')) score -= 40;
  if (id.includes('preview')) score -= 15;
  if (/\d{2}-\d{4}|\d{3}$/.test(id)) score -= 25;

  return score;
}

async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const cached = modelCacheByKey.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
    return cached.models;
  }

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(listUrl, { method: 'GET' });
    if (!res.ok) {
      return [...DEFAULT_FALLBACK_MODELS];
    }

    const data = (await res.json()) as GeminiListModelsResponse;
    const rawModels = Array.isArray(data.models) ? data.models : [];

    const candidates = rawModels
      .filter((m) => {
        if (!m.name) return false;
        const methods = m.supportedGenerationMethods ?? [];
        if (!methods.includes('generateContent')) return false;
        const id = m.name.replace(/^models\//, '').toLowerCase();
        if (!id.startsWith('gemini')) return false;
        if (EXCLUDED_MODEL_KEYWORDS.some((kw) => id.includes(kw))) return false;
        return true;
      })
      .map((m) => m.name!.replace(/^models\//, ''));

    const uniqueSorted = Array.from(new Set(candidates)).sort(
      (a, b) => scoreGeminiModel(b) - scoreGeminiModel(a)
    );

    if (uniqueSorted.length > 0) {
      const topModels = uniqueSorted.slice(0, 8);
      modelCacheByKey.set(apiKey, { fetchedAt: Date.now(), models: topModels });
      return topModels;
    }
  } catch {
    // fallback
  }

  return [...DEFAULT_FALLBACK_MODELS];
}

function extractTextFromResponse(data: GeminiGenerateResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const normalText = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
  if (normalText) return normalText;
  return parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
}

async function callGeminiGenerateContent(
  apiKey: string,
  body: Record<string, unknown>,
  errorPrefix: string
): Promise<string> {
  const modelsToTry = await fetchAvailableGeminiModels(apiKey);
  const errors: string[] = [];

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const maxAttempts = 1 + RETRY_DELAYS_MS.length;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = (await response.json()) as GeminiGenerateResponse;
          const rawText = extractTextFromResponse(data);
          if (rawText) {
            return rawText;
          }
          errors.push(`${model}: 空のレスポンス`);
          break;
        }

        const errText = await response.text().catch(() => '');
        const shortErr = errText ? ` (${errText.slice(0, 100)})` : '';

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `${errorPrefix}（ステータス ${response.status}）。Gemini APIキーが正しいかご確認ください。${shortErr}`
          );
        }

        if (
          (response.status === 503 || response.status === 429) &&
          attempt < RETRY_DELAYS_MS.length
        ) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }

        errors.push(
          `${model}: ステータス ${response.status}${
            attempt > 0 ? `（${attempt}回リトライ後）` : ''
          }${shortErr}`
        );
        break;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith(errorPrefix)) {
          throw err;
        }
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        errors.push(
          `${model}: ${err instanceof Error ? err.message : 'ネットワークエラー'}`
        );
        break;
      }
    }
  }

  throw new Error(
    `${errorPrefix}。しばらく時間をおいて再度お試しいただくか、APIキーをご確認ください。（試行モデル: ${errors.join(
      ' / '
    )}）`
  );
}

export async function generateGeminiMealSuggestions(
  profile: UserProfile,
  inventory: InventoryItem[]
): Promise<SuggestedMeal[]> {
  const apiKey = profile.geminiApiKey.trim();
  if (!apiKey) {
    throw new Error('Gemini APIキーが未設定です。「設定」画面でAPIキーを入力してください。');
  }

  const daily = calculateDailyTargets(profileToNutritionInput(profile));
  const conditionNames = profile.selectedConditions.map((c) => getConditionMeta(c).name);
  const chemoNames = profile.chemoSymptoms
    .map((s) => getChemoGuidanceMeta(s)?.name)
    .filter(Boolean);

  const inventoryText =
    inventory.length > 0
      ? inventory
          .map(
            (i) =>
              `- ${i.name}（数量:${i.quantityText || '記載なし'} / 残量:${STOCK_LEVEL_META[i.stockLevel].label}）`
          )
          .join('\n')
      : '在庫登録なし';

  const targetSummaryLines = (
    ['energy', 'protein', 'salt', 'potassium', 'phosphorus', 'water', 'fiber'] as NutrientKey[]
  ).map((k) => {
    const meta = NUTRIENT_META[k];
    return `- ${meta.label}（1日）: ${formatDailyTarget(daily.targets[k], meta.unit)}`;
  });

  const prompt = `あなたは日本の家庭料理アドバイザーです。
以下の条件と自宅在庫をもとに、日本の家庭で作れる献立を3パターン提案してください。

【重要なルール】
- 医療行為ではなく参考提案としてください。
- 栄養価の数値はアプリ側で日本食品標準成分表（八訂）元データから厳密に自動計算するため、AIはカロリーや塩分などの栄養数値を一切生成しないでください。
- 代わりに、1人分の使用食材とグラム数（grams：必ず1〜500g程度の現実的な1人分量）、および必要に応じて下処理タグ（prepTags: "boil_drain"=ゆでこぼし / "water_soak"=水さらし）を ingredientsPerServing 配列に出力してください。
- 塩分や脂質が大きく違う食材は曖昧に書かず、具体的な種類を明記してください（例：「しょうゆ」ではなく「しょうゆ（こいくち）」や「減塩しょうゆ」、「鮭」ではなく「生鮭」や「塩鮭」、「みそ」ではなく「みそ（淡色・辛口）」や「減塩みそ（だし入り）」、「鶏むね」ではなく「鶏むね（皮なし）」、「豆腐」ではなく「絹ごし豆腐」）。
- 塩・しょうゆ・みそ等の調味料も必ず書き落とさず ingredientsPerServing に含めてください。
${profile.avoidRawFood ? '- 生もの（生肉・刺身・生野菜）・非加熱の発酵食品・ドライフルーツは必ず除外してください。' : ''}

【設定条件】
- 作る人数: ${profile.servings}人分
- 選択中の状態: ${conditionNames.join('、')}
${chemoNames.length > 0 ? `- 抗がん剤副作用: ${chemoNames.join('、')}` : ''}
${daily.cookingFormTags.length > 0 ? `- 配慮する調理形態: ${daily.cookingFormTags.join('、')}` : ''}
- 1日の目安:
${targetSummaryLines.join('\n')}
${profile.doctorNote ? `- 病院からのメモ: ${profile.doctorNote}` : ''}

【自宅在庫】
${inventoryText}

【出力形式（JSON配列・要素数3のみ）】
[
  {
    "title": "料理名",
    "subtitle": "短い紹介文（30文字以内）",
    "category": "カテゴリ",
    "cookTimeMin": 15,
    "ingredientsPerServing": [
      { "name": "鶏むね（皮なし）", "grams": 80 },
      { "name": "白菜", "grams": 70, "prepTags": ["boil_drain"] },
      { "name": "しょうゆ（こいくち）", "grams": 4.5 }
    ],
    "availableIngredients": [{ "name": "家にある食材名", "amount": "${profile.servings}人分の分量" }],
    "missingIngredients": [{ "name": "買い足し食材名", "amount": "${profile.servings}人分の分量" }],
    "steps": ["手順1", "手順2", "手順3"],
    "careTips": [{ "label": "配慮ポイント", "tip": "減塩・食べやすさ等の工夫" }],
    "matchReason": "在庫と状態に合った理由（40文字以内）"
  }
]`;

  const rawText = await callGeminiGenerateContent(
    apiKey,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    },
    'Gemini APIの呼び出しに失敗しました'
  );
  const parsed = JSON.parse(stripJsonFences(rawText)) as GeminiMealRaw[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini APIから有効な献立データを受け取れませんでした。');
  }

  return parsed.slice(0, 3).map((item, idx) => {
    const avail = Array.isArray(item.availableIngredients) ? item.availableIngredients : [];
    const missing = Array.isArray(item.missingIngredients) ? item.missingIngredients : [];
    const total = avail.length + missing.length;
    const title = item.title || `AIおすすめ献立 ${idx + 1}`;

    const ingredientInputs: DishIngredientInput[] = Array.isArray(
      item.ingredientsPerServing
    )
      ? item.ingredientsPerServing
          .filter((fi) => Boolean(fi?.name))
          .map((fi) => ({
            name: String(fi.name).trim(),
            grams: Number(fi.grams),
            prepTags: Array.isArray(fi.prepTags)
              ? fi.prepTags.filter(
                  (t): t is PrepMethodTag =>
                    t === 'boil_drain' || t === 'water_soak'
                )
              : undefined,
          }))
      : [];

    // 安全のきまり：八訂元データで計算＋AI材料チェック（未登録・曖昧・異常g数・食塩調味料なし）
    const calc = calculateDishNutrition(ingredientInputs, {
      checkSaltySeasoning: true,
    });

    const extraReasons =
      ingredientInputs.length === 0
        ? ['AIから材料のグラム数が返されませんでした（要確認）']
        : [];
    const verificationReasons = [...extraReasons, ...calc.verificationReasons];
    const needsVerification =
      calc.needsVerification || ingredientInputs.length === 0;

    return {
      id: `gemini-${Date.now()}-${idx}`,
      title,
      subtitle: item.subtitle || 'AIが在庫と体調に合わせて提案した献立',
      category: item.category || 'AI提案',
      cookTimeMin: Number(item.cookTimeMin) || 15,
      nutritionPerServing: calc.nutrition,
      exactNutrition: calc.exactNutrition,
      missingMeasurementNutrients: calc.missingMeasurementNutrients,
      matchedFoodMappings: calc.matchedItems.map((m) => ({
        inputName: m.inputName,
        foodId: m.matchedFood.id,
        name: m.matchedFood.name,
        official: m.matchedFood.official,
        grams: m.grams,
      })),
      nutritionBasisNote:
        '文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成',
      unmatchedIngredients: calc.unmatchedIngredients,
      needsVerification,
      verificationReasons,
      prepNotices: calc.prepNotices,
      servings: profile.servings,
      availableIngredients: avail.map((x) => ({ name: x.name, amount: x.amount })),
      missingIngredients: missing.map((x) => ({ name: x.name, amount: x.amount })),
      steps:
        Array.isArray(item.steps) && item.steps.length > 0
          ? item.steps
          : ['材料を切り、火が通るまで調理してください。'],
      careTips:
        Array.isArray(item.careTips) && item.careTips.length > 0
          ? item.careTips
          : [{ label: '調理メモ', tip: '味見をしながら調味料を加減してください。' }],
      cookingFormTags: daily.cookingFormTags.slice(0, 4),
      flags: calc.detectedFlags,
      matchReason: item.matchReason || 'Gemini AIが在庫と状態から提案しました',
      source: 'gemini',
      youtubeQuery: `${title} レシピ`,
      stockMatchRate: total > 0 ? avail.length / total : 0.7,
    };
  });
}

function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      if (commaIdx < 0) {
        reject(new Error('画像の読み込みに失敗しました。'));
        return;
      }
      resolve({
        mimeType: file.type || 'image/jpeg',
        data: result.slice(commaIdx + 1),
      });
    };
    reader.onerror = () => reject(new Error('画像ファイルの読み取りエラーが発生しました。'));
    reader.readAsDataURL(file);
  });
}

export async function extractFlyerDealsWithGeminiVision(
  apiKey: string,
  file: File,
  fallbackStoreName?: string
): Promise<FlyerEntry> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error(
      'Gemini APIキーが未設定です。「設定」画面でAPIキーを入力するか、「サンプルチラシ読み取りテスト」をお試しください。'
    );
  }

  const { mimeType, data } = await fileToBase64(file);

  const prompt = `この画像は日本のスーパーマーケットまたはドラッグストアの特売チラシ・価格表です。
画像から「店舗名」と「食料品・調味料の特売商品名・価格・特記事項（グラム数や限定日など）」を読み取り、以下のJSON形式のみで返してください。
店舗名が画像から読み取れない場合は "${fallbackStoreName || '特売スーパー'}" を使用してください。
{
  "storeName": "〇〇スーパー",
  "items": [
    { "name": "商品名（食材名が分かりやすく）", "priceText": "98円(税抜)", "note": "100gあたり / 日替わり等" }
  ]
}`;

  const rawText = await callGeminiGenerateContent(
    trimmedKey,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    },
    'Gemini Vision APIの呼び出しに失敗しました'
  );
  const parsed = JSON.parse(stripJsonFences(rawText)) as GeminiFlyerRaw;

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((i) => i && i.name)
        .map((i, idx) => ({
          id: `deal-${Date.now()}-${idx}`,
          name: String(i.name).trim(),
          priceText: String(i.priceText || '特売').trim(),
          note: i.note ? String(i.note).trim() : undefined,
        }))
    : [];

  if (items.length === 0) {
    throw new Error(
      '画像から特売食材を読み取れませんでした。もう少し明るい・鮮明な画像でお試しください。'
    );
  }

  return {
    id: `flyer-${Date.now()}`,
    storeName: parsed.storeName?.trim() || fallbackStoreName?.trim() || '特売スーパー',
    sourceType: 'image_ai',
    memoOrUrl: file.name,
    createdAt: new Date().toISOString(),
    items,
  };
}
