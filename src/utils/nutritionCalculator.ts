import {
  FOOD_COMPOSITION_BY_ID,
  FOOD_COMPOSITION_MASTER,
  type FoodCompositionItem,
  type FoodSafetyFlags,
} from '../data/foodComposition';
import type { NutrientKey } from '../nutrition/referenceData';
import type { RecipeNutrition } from '../types';

export type PrepMethodTag = 'boil_drain' | 'water_soak';

export const BOIL_DRAIN_NO_DEDUCTION_NOTICE =
  'ゆでこぼしで減る分は引いていません（実際より多めに表示）';

export interface OfficialBoiledConversion {
  boiledFoodId: string;
  /** 成分表の重量変化率（例：0.90 = ゆで後に重量が90%になる） */
  weightChangeRate: number;
}

export interface DishIngredientInput {
  name: string;
  foodId?: string;
  grams: number;
  prepTags?: PrepMethodTag[];
  /**
   * 成分表の「ゆで」項目と公式の重量変化率が両方そろっている場合のみ使用可能。
   * そろわない場合は生の値で計算し、割合補正は行わない。
   */
  officialBoiledConversion?: OfficialBoiledConversion;
}

export interface AmbiguousIngredientMatch {
  inputName: string;
  reason: string;
  candidates: FoodCompositionItem[];
}

export interface MatchedIngredientBreakdown {
  inputName: string;
  matchedFood: FoodCompositionItem;
  grams: number;
  prepTags: PrepMethodTag[];
  usedBoiledConversion: boolean;
}

export type NullableRecipeNutrition = {
  energy: number | null;
  protein: number | null;
  fat: number | null;
  carb: number | null;
  fiber: number | null;
  salt: number | null;
  potassium: number | null;
  phosphorus: number | null;
  water: number | null;
};

export interface DishNutritionResult {
  /** 既存UI・合算用（未測定nullの項目は0として扱わず missingMeasurementNutrients に記録する） */
  nutrition: RecipeNutrition;
  /** 未測定（-）を含む項目は null のまま保持（0として足さない） */
  exactNutrition: NullableRecipeNutrition;
  missingMeasurementNutrients: NutrientKey[];
  matchedItems: MatchedIngredientBreakdown[];
  unmatchedIngredients: string[];
  ambiguousIngredients: AmbiguousIngredientMatch[];
  invalidGramIngredients: string[];
  missingSaltySeasoning: boolean;
  needsVerification: boolean;
  verificationReasons: string[];
  prepNotices: string[];
  detectedFlags: FoodSafetyFlags;
}

export type FoodResolutionResult =
  | { status: 'matched'; food: FoodCompositionItem }
  | { status: 'ambiguous'; reason: string; candidates: FoodCompositionItem[] }
  | { status: 'unmatched' };

function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function normalizeFoodName(raw: string): string {
  return katakanaToHiragana(
    raw
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　・/／\-_]/g, '')
  );
}

function stripParentheses(raw: string): string {
  return raw.replace(/[（(][^）)]*[）)]/g, '').trim();
}

/**
 * 名前が似ていて塩分などが大きく違う食材で、1つに決められないときは
 * 自動で片方を選ばず「要確認（ambiguous）」にするルール。
 */
interface AmbiguousRule {
  exactNorms: string[];
  candidateIds: string[];
  reason: string;
}

const AMBIGUOUS_RULES: AmbiguousRule[] = [
  {
    exactNorms: ['鮭', 'さけ', 'しゃけ', 'さーもん', '鮭切り身', '切り身鮭'].map(
      normalizeFoodName
    ),
    candidateIds: ['10134', '10139'],
    reason: '生鮭（食塩0.2g）と塩鮭（食塩1.8g）で塩分が大きく異なるため特定できません',
  },
  {
    exactNorms: ['しょうゆ', '醤油', 'しょう油'].map(normalizeFoodName),
    candidateIds: ['17007', '17086', '17008'],
    reason:
      'こいくち（14.5g）・減塩（8.3g）・うすくち（16.0g）で塩分が大きく異なるため特定できません',
  },
  {
    exactNorms: ['みそ', '味噌', '合わせみそ', '合わせ味噌'].map(normalizeFoodName),
    candidateIds: ['17045', '17046', '17044', '17145'],
    reason: '淡色辛みそ・赤みそ・白みそ・減塩みそで塩分が大きく異なるため特定できません',
  },
  {
    exactNorms: ['梅干し', 'うめぼし', '梅干'].map(normalizeFoodName),
    candidateIds: ['07023', '07022'],
    reason: '調味漬（7.6g）と塩漬（18.2g）で塩分が大きく異なるため特定できません',
  },
  {
    exactNorms: ['漬物', 'つけもの', 'お漬物', '漬け物'].map(normalizeFoodName),
    candidateIds: ['06236', '06138', '06068'],
    reason: '漬物の種類により塩分が大きく異なるため特定できません',
  },
  {
    exactNorms: ['ハム', 'はむ', 'ハムベーコン', '加工肉'].map(normalizeFoodName),
    candidateIds: ['11176', '11183', '11186'],
    reason: 'ハム・ベーコン等の種類により塩分・脂質が異なるため特定できません',
  },
  {
    exactNorms: ['めんつゆ', '麺つゆ', 'つゆ'].map(normalizeFoodName),
    candidateIds: ['17029', '17030'],
    reason: 'ストレート（3.3g）と3倍濃縮（9.9g）で塩分が3倍異なるため特定できません',
  },
  {
    exactNorms: ['ツナ', 'ツナ缶', 'つな', 'つなかん', 'シーチキン'].map(
      normalizeFoodName
    ),
    candidateIds: ['10260', '10263'],
    reason: '水煮と油漬でエネルギー・脂質が大きく異なるため特定できません',
  },
  {
    exactNorms: ['さば缶', 'サバ缶', '鯖缶'].map(normalizeFoodName),
    candidateIds: ['10164', '10165'],
    reason: '水煮とみそ煮でエネルギー・塩分が異なるため特定できません',
  },
  {
    exactNorms: ['ドレッシング', 'どれっしんぐ'].map(normalizeFoodName),
    candidateIds: ['17116', '17039', '17117', '17040'],
    reason: '種類により塩分（3.5g〜7.4g）と脂質が大きく異なるため特定できません',
  },
  {
    exactNorms: ['ソース', 'そーす'].map(normalizeFoodName),
    candidateIds: ['17001', '17002'],
    reason: 'ウスターソース（8.5g）と中濃ソース（5.8g）で塩分が異なるため特定できません',
  },
  {
    exactNorms: ['のり', '海苔', 'のりのり'].map(normalizeFoodName),
    candidateIds: ['09004', '09005'],
    reason: '焼きのり（1.3g）と味付けのり（4.3g）で塩分が異なるため特定できません',
  },
  {
    exactNorms: ['豆腐', 'とうふ'].map(normalizeFoodName),
    candidateIds: ['04033', '04032'],
    reason: '絹ごし豆腐と木綿豆腐でたんぱく質・カリウムが異なるため確認が必要です',
  },
  {
    exactNorms: ['鶏むね', '鶏むね肉', '鶏胸肉', 'とりむね', 'とりむね肉'].map(
      normalizeFoodName
    ),
    candidateIds: ['11220', '11219'],
    reason: '皮なしと皮つきでエネルギー・脂質が異なるため確認が必要です',
  },
  {
    exactNorms: ['鶏もも', '鶏もも肉', 'とりもも', 'とりもも肉'].map(
      normalizeFoodName
    ),
    candidateIds: ['11224', '11221'],
    reason: '皮なしと皮つきでエネルギー・脂質が大きく異なるため確認が必要です',
  },
];

interface IndexedTerm {
  norm: string;
  item: FoodCompositionItem;
}

const INDEXED_TERMS: IndexedTerm[] = (() => {
  const list: IndexedTerm[] = [];
  for (const item of FOOD_COMPOSITION_MASTER) {
    const terms = [item.name, item.official, ...item.aliases];
    const seen = new Set<string>();
    for (const term of terms) {
      const norm = normalizeFoodName(term);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({ norm, item });
      }
      const stripped = normalizeFoodName(stripParentheses(term));
      if (stripped && !seen.has(stripped)) {
        seen.add(stripped);
        list.push({ norm: stripped, item });
      }
    }
  }
  list.sort((a, b) => b.norm.length - a.norm.length);
  return list;
})();

/**
 * 食材名または食品番号から成分表マスターへ照合する。
 * 塩分等が大きく異なる曖昧語は自動で片方を選ばず ambiguous を返す。
 */
export function resolveFoodComposition(
  nameOrId: string,
  explicitFoodId?: string
): FoodResolutionResult {
  if (explicitFoodId && FOOD_COMPOSITION_BY_ID[explicitFoodId]) {
    return { status: 'matched', food: FOOD_COMPOSITION_BY_ID[explicitFoodId] };
  }

  const trimmed = nameOrId.trim();
  if (!trimmed) return { status: 'unmatched' };

  if (FOOD_COMPOSITION_BY_ID[trimmed]) {
    return { status: 'matched', food: FOOD_COMPOSITION_BY_ID[trimmed] };
  }

  const normFull = normalizeFoodName(trimmed);
  const normStripped = normalizeFoodName(stripParentheses(trimmed));

  // 1. 曖昧語チェック（1つに決められない場合は自動で片方を選ばない）
  for (const rule of AMBIGUOUS_RULES) {
    if (rule.exactNorms.includes(normFull)) {
      const candidates = rule.candidateIds
        .map((id) => FOOD_COMPOSITION_BY_ID[id])
        .filter((f): f is FoodCompositionItem => Boolean(f));
      return { status: 'ambiguous', reason: rule.reason, candidates };
    }
  }

  // 2. 完全一致（フル文字列 → 括弧除去後）
  for (const entry of INDEXED_TERMS) {
    if (entry.norm === normFull) {
      return { status: 'matched', food: entry.item };
    }
  }
  if (normStripped && normStripped !== normFull) {
    // 括弧を剥がした結果が曖昧語になる場合は自動で選ばない
    for (const rule of AMBIGUOUS_RULES) {
      if (rule.exactNorms.includes(normStripped)) {
        const candidates = rule.candidateIds
          .map((id) => FOOD_COMPOSITION_BY_ID[id])
          .filter((f): f is FoodCompositionItem => Boolean(f));
        return { status: 'ambiguous', reason: rule.reason, candidates };
      }
    }
    for (const entry of INDEXED_TERMS) {
      if (entry.norm === normStripped) {
        return { status: 'matched', food: entry.item };
      }
    }
  }

  // 3. 入力文字列が登録語を含む場合（最長一致優先。ただし登録語自体が曖昧語に該当する場合は除外）
  const allAmbiguousTerms = new Set(AMBIGUOUS_RULES.flatMap((r) => r.exactNorms));
  for (const entry of INDEXED_TERMS) {
    if (
      entry.norm.length >= 2 &&
      !allAmbiguousTerms.has(entry.norm) &&
      normFull.includes(entry.norm)
    ) {
      return { status: 'matched', food: entry.item };
    }
  }

  // 4. 部分一致で曖昧語に当たる場合（例：「特選しょうゆ」など）は ambiguous を返す
  for (const rule of AMBIGUOUS_RULES) {
    if (rule.exactNorms.some((t) => t.length >= 2 && normFull.includes(t))) {
      const candidates = rule.candidateIds
        .map((id) => FOOD_COMPOSITION_BY_ID[id])
        .filter((f): f is FoodCompositionItem => Boolean(f));
      return { status: 'ambiguous', reason: rule.reason, candidates };
    }
  }

  return { status: 'unmatched' };
}

export function findFoodComposition(
  nameOrId: string,
  explicitFoodId?: string
): FoodCompositionItem | null {
  const res = resolveFoodComposition(nameOrId, explicitFoodId);
  return res.status === 'matched' ? res.food : null;
}

export function searchFoodComposition(
  query: string,
  limit = 15
): FoodCompositionItem[] {
  const norm = normalizeFoodName(query.trim());
  if (!norm) {
    return FOOD_COMPOSITION_MASTER.slice(0, limit);
  }

  const scored: { item: FoodCompositionItem; score: number }[] = [];
  for (const item of FOOD_COMPOSITION_MASTER) {
    const terms = [item.id, item.name, item.official, ...item.aliases].map(
      normalizeFoodName
    );
    let best = 0;
    for (const t of terms) {
      if (t === norm) best = Math.max(best, 100);
      else if (t.startsWith(norm)) best = Math.max(best, 70);
      else if (t.includes(norm)) best = Math.max(best, 40);
    }
    if (best > 0) {
      scored.push({ item, score: best });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

export interface CalculateDishOptions {
  /** 料理として食塩を含む調味料の記載漏れをチェックする（AI提案・完成料理は true） */
  checkSaltySeasoning?: boolean;
}

/**
 * 1人分の材料リストから日本食品標準成分表（八訂）元データで栄養価を厳密に合算する。
 * - null（未測定）は 0 として足さず missingMeasurementNutrients に記録する
 * - ゆでこぼし・水さらしは定率%補正を一切行わず、公式ゆで項目＋重量変化率が揃わない場合は生の値で計算し注記を出す
 * - 未登録・曖昧一致・異常グラム数（<=0 または >1000g）・食塩調味料なしを検知し needsVerification を立てる
 */
export function calculateDishNutrition(
  ingredients: DishIngredientInput[],
  options: CalculateDishOptions = {}
): DishNutritionResult {
  const { checkSaltySeasoning = false } = options;

  let energy = 0;
  let protein = 0;
  let fat = 0;
  let carb = 0;
  let fiber = 0;
  let salt = 0;
  let potassium = 0;
  let phosphorus = 0;
  let water = 0;

  const missingNullSet = new Set<NutrientKey>();
  const matchedItems: MatchedIngredientBreakdown[] = [];
  const unmatchedIngredients: string[] = [];
  const ambiguousIngredients: AmbiguousIngredientMatch[] = [];
  const invalidGramIngredients: string[] = [];
  const prepNoticesSet = new Set<string>();
  const detectedFlags: FoodSafetyFlags = {};

  let hasSaltySeasoning = false;

  for (const ing of ingredients) {
    const label = ing.name.trim() || ing.foodId || '(名称不明)';
    const grams = Number(ing.grams);

    // ルール4：明らかにおかしいg数（0以下、または1人分で1,000g超）
    if (Number.isNaN(grams) || grams <= 0 || grams > 1000) {
      invalidGramIngredients.push(
        `${label}（${Number.isNaN(grams) ? '数値不正' : `${grams}g`}）`
      );
      continue;
    }

    const resolution = resolveFoodComposition(ing.name, ing.foodId);
    if (resolution.status === 'unmatched') {
      if (!unmatchedIngredients.includes(label)) {
        unmatchedIngredients.push(label);
      }
      continue;
    }
    if (resolution.status === 'ambiguous') {
      ambiguousIngredients.push({
        inputName: label,
        reason: resolution.reason,
        candidates: resolution.candidates,
      });
      continue;
    }

    let food = resolution.food;
    let effectiveGrams = grams;
    let usedBoiledConversion = false;
    const prepTags = ing.prepTags ?? [];

    // ルール2：ゆでこぼし・水さらし
    // 成分表の「ゆで」項目＋公式重量変化率の両方がそろっている場合のみ使用。それ以外は一切%補正しない。
    if (
      ing.officialBoiledConversion &&
      FOOD_COMPOSITION_BY_ID[ing.officialBoiledConversion.boiledFoodId] &&
      ing.officialBoiledConversion.weightChangeRate > 0
    ) {
      food = FOOD_COMPOSITION_BY_ID[ing.officialBoiledConversion.boiledFoodId];
      effectiveGrams = grams * ing.officialBoiledConversion.weightChangeRate;
      usedBoiledConversion = true;
    } else if (
      prepTags.includes('boil_drain') ||
      prepTags.includes('water_soak')
    ) {
      prepNoticesSet.add(BOIL_DRAIN_NO_DEDUCTION_NOTICE);
    }

    const ratio = effectiveGrams / 100;
    const p = food.per100g;

    // null（未測定）は0として足さない
    if (p.kcal == null) missingNullSet.add('energy');
    else energy += p.kcal * ratio;

    if (p.protein == null) missingNullSet.add('protein');
    else protein += p.protein * ratio;

    if (p.fat == null) missingNullSet.add('fat');
    else fat += p.fat * ratio;

    if (p.carb == null) missingNullSet.add('carb');
    else carb += p.carb * ratio;

    if (p.fiber == null) missingNullSet.add('fiber');
    else fiber += p.fiber * ratio;

    if (p.salt == null) missingNullSet.add('salt');
    else salt += p.salt * ratio;

    if (p.potassium == null) missingNullSet.add('potassium');
    else potassium += p.potassium * ratio;

    if (p.phosphorus == null) missingNullSet.add('phosphorus');
    else phosphorus += p.phosphorus * ratio;

    if (p.water == null) missingNullSet.add('water');
    else water += p.water * ratio;

    // 食塩を含む調味料チェック（塩・しょうゆ・みそ・だし素・ソース・ドレッシング・マヨ・ケチャップ等）
    if (
      (food.category === '調味料' || food.category === '漬物') &&
      p.salt != null &&
      p.salt > 0
    ) {
      hasSaltySeasoning = true;
    }

    matchedItems.push({
      inputName: label,
      matchedFood: food,
      grams: effectiveGrams,
      prepTags,
      usedBoiledConversion,
    });

    if (food.flags.rawMeatFish) detectedFlags.rawMeatFish = true;
    if (food.flags.rawVeg) detectedFlags.rawVeg = true;
    if (food.flags.fermented) detectedFlags.fermented = true;
    if (food.flags.heatedFermented) detectedFlags.heatedFermented = true;
    if (food.flags.driedFruit) detectedFlags.driedFruit = true;
  }

  const missingSaltySeasoning =
    checkSaltySeasoning && matchedItems.length > 0 && !hasSaltySeasoning;

  const verificationReasons: string[] = [];
  if (unmatchedIngredients.length > 0) {
    verificationReasons.push(
      `成分表に結びつかない材料があります：${unmatchedIngredients.join('、')}`
    );
  }
  if (ambiguousIngredients.length > 0) {
    verificationReasons.push(
      `種類が1つに決められない材料があります（要確認）：${ambiguousIngredients
        .map((a) => `${a.inputName}（${a.reason}）`)
        .join(' ／ ')}`
    );
  }
  if (invalidGramIngredients.length > 0) {
    verificationReasons.push(
      `使用量（g）に異常値があります（0g以下または1,000g超）：${invalidGramIngredients.join('、')}`
    );
  }
  if (missingSaltySeasoning) {
    verificationReasons.push(
      '塩・しょうゆ・みそ等の食塩を含む調味料が見当たりません（書き落としの可能性があるため要確認）'
    );
  }

  const needsVerification = verificationReasons.length > 0;
  const missingMeasurementNutrients = Array.from(missingNullSet);

  const roundedEnergy = Math.round(energy);
  const roundedProtein = round1(protein);
  const roundedFat = round1(fat);
  const roundedCarb = round1(carb);
  const roundedFiber = round1(fiber);
  const roundedSalt = round1(salt);
  const roundedPotassium = Math.round(potassium);
  const roundedPhosphorus = Math.round(phosphorus);
  const roundedWater = Math.round(water);

  return {
    nutrition: {
      caloriesKcal: roundedEnergy,
      proteinG: roundedProtein,
      fatG: roundedFat,
      carbsG: roundedCarb,
      fiberG: roundedFiber,
      saltG: roundedSalt,
      potassiumMg: roundedPotassium,
      phosphorusMg: roundedPhosphorus,
      fluidMl: roundedWater,
    },
    exactNutrition: {
      energy: missingNullSet.has('energy') ? null : roundedEnergy,
      protein: missingNullSet.has('protein') ? null : roundedProtein,
      fat: missingNullSet.has('fat') ? null : roundedFat,
      carb: missingNullSet.has('carb') ? null : roundedCarb,
      fiber: missingNullSet.has('fiber') ? null : roundedFiber,
      salt: missingNullSet.has('salt') ? null : roundedSalt,
      potassium: missingNullSet.has('potassium') ? null : roundedPotassium,
      phosphorus: missingNullSet.has('phosphorus') ? null : roundedPhosphorus,
      water: missingNullSet.has('water') ? null : roundedWater,
    },
    missingMeasurementNutrients,
    matchedItems,
    unmatchedIngredients,
    ambiguousIngredients,
    invalidGramIngredients,
    missingSaltySeasoning,
    needsVerification,
    verificationReasons,
    prepNotices: Array.from(prepNoticesSet),
    detectedFlags,
  };
}
