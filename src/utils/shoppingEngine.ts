import type { FlyerEntry, ShoppingItem, SuggestedMeal } from '../types';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(].*?[)）]/g, '');
}

/**
 * APIキーなしでもチラシ読み取り＆お店別振り分けを試せるサンプルデータ
 */
export function createSampleFlyers(): FlyerEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: `flyer-sample-super-${Date.now()}`,
      storeName: '〇〇スーパー',
      sourceType: 'sample',
      memoOrUrl: '今週の週末特売チラシ（サンプル読み取り）',
      createdAt: now,
      items: [
        { id: 'sd-1', name: '国産 鶏むね肉', priceText: '100g 68円', note: '特売' },
        { id: 'sd-2', name: '豚こま切れ肉', priceText: '100g 98円', note: '大パック' },
        { id: 'sd-3', name: '生鮭切り身（甘塩なし）', priceText: '2切れ 298円', note: '減塩向け' },
        { id: 'sd-4', name: 'キャベツ', priceText: '1玉 138円', note: '朝採れ' },
        { id: 'sd-5', name: 'ぶなしめじ・きのこ各種', priceText: '1パック 88円', note: 'よりどり' },
        { id: 'sd-6', name: '白身魚（生たら切り身）', priceText: '2切れ 278円', note: '鮮魚コーナー' },
      ],
    },
    {
      id: `flyer-sample-drug-${Date.now() + 1}`,
      storeName: '△△ドラッグストア',
      sourceType: 'sample',
      memoOrUrl: '食品ポイント5倍デーチラシ（サンプル読み取り）',
      createdAt: now,
      items: [
        { id: 'dd-1', name: '絹ごし豆腐（3連パック）', priceText: '98円', note: '日替わり' },
        { id: 'dd-2', name: 'たまご（10個入）', priceText: '198円', note: 'お1人様1パック' },
        { id: 'dd-3', name: '減塩醤油（450ml）', priceText: '228円', note: '塩分40%カット' },
        { id: 'dd-4', name: '冷凍うどん（5食入）', priceText: '248円', note: '冷凍食品' },
        { id: 'dd-5', name: '片栗粉・だしパック', priceText: '各158円', note: '調味料特売' },
        { id: 'dd-6', name: '玉ねぎ（1袋3個入）', priceText: '158円', note: 'お買い得' },
      ],
    },
  ];
}

/**
 * テキストまたはURLメモからチラシ特売エントリを作成
 */
export function parseTextFlyerMemo(
  storeName: string,
  memoText: string,
  urlMemo?: string
): FlyerEntry {
  const lines = memoText
    .split(/\r?\n|、|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines.map((line, idx) => {
    const priceMatch = line.match(/(\d+[\d,]*\s*円[^\s]*|\d+%引き|\d+円引き)/);
    if (priceMatch) {
      const priceText = priceMatch[0].trim();
      const name = line.replace(priceMatch[0], '').trim() || line;
      return {
        id: `txt-${Date.now()}-${idx}`,
        name,
        priceText,
      };
    }
    return {
      id: `txt-${Date.now()}-${idx}`,
      name: line,
      priceText: '特売メモ',
    };
  });

  return {
    id: `flyer-memo-${Date.now()}`,
    storeName: storeName.trim() || 'メモ店舗',
    sourceType: 'text_memo',
    memoOrUrl: urlMemo?.trim() || undefined,
    createdAt: new Date().toISOString(),
    items,
  };
}

/**
 * 食材名とチラシ特売商品を照合する
 */
export function matchShoppingItemsWithFlyers(
  items: ShoppingItem[],
  flyers: FlyerEntry[]
): ShoppingItem[] {
  return items.map((item) => {
    const targetNorm = normalize(item.name);
    let matchedStoreName: string | undefined;
    let matchedPriceText: string | undefined;
    let matchedDealName: string | undefined;

    // 食材の主要キーワード抽出（「生鮭切り身」→「鮭」「生鮭」など）
    const tokens = [
      targetNorm,
      ...targetNorm.split(/[・/／\s]/).filter((t) => t.length >= 2),
    ];

    outer: for (const flyer of flyers) {
      for (const deal of flyer.items) {
        const dealNorm = normalize(deal.name);
        if (!dealNorm) continue;
        const isHit = tokens.some(
          (tok) => tok && (dealNorm.includes(tok) || tok.includes(dealNorm))
        );
        if (isHit) {
          matchedStoreName = flyer.storeName;
          matchedPriceText = deal.priceText;
          matchedDealName = deal.name;
          break outer;
        }
      }
    }

    return {
      ...item,
      matchedStoreName,
      matchedPriceText,
      matchedDealName,
    };
  });
}

/**
 * 提案中の献立から不足食材を取り出して買い物リストへ統合（既存チェック状態・手動アイテムを保持）
 */
export function buildSyncedShoppingList(
  meals: SuggestedMeal[],
  existingItems: ShoppingItem[],
  flyers: FlyerEntry[]
): ShoppingItem[] {
  const manualItems = existingItems.filter((i) => i.isManual);
  const checkedByNorm = new Map<string, boolean>();
  existingItems.forEach((i) => checkedByNorm.set(normalize(i.name), i.checked));

  const mealMissingMap = new Map<string, ShoppingItem>();
  for (const meal of meals) {
    for (const ing of meal.missingIngredients) {
      const key = normalize(ing.name);
      if (!mealMissingMap.has(key)) {
        mealMissingMap.set(key, {
          id: `auto-${key}`,
          name: ing.name,
          amount: ing.amount,
          checked: checkedByNorm.get(key) ?? false,
          sourceMealTitle: meal.title,
          isManual: false,
        });
      }
    }
  }

  const combined = [...Array.from(mealMissingMap.values()), ...manualItems];
  return matchShoppingItemsWithFlyers(combined, flyers);
}

export interface StoreShoppingGroup {
  storeKey: string;
  heading: string;
  isMatchedStore: boolean;
  items: ShoppingItem[];
}

export function groupShoppingByStore(items: ShoppingItem[]): StoreShoppingGroup[] {
  const byStore = new Map<string, ShoppingItem[]>();
  const others: ShoppingItem[] = [];

  for (const item of items) {
    if (item.matchedStoreName) {
      const list = byStore.get(item.matchedStoreName) ?? [];
      list.push(item);
      byStore.set(item.matchedStoreName, list);
    } else {
      others.push(item);
    }
  }

  const groups: StoreShoppingGroup[] = [];
  for (const [storeName, storeItems] of byStore.entries()) {
    groups.push({
      storeKey: storeName,
      heading: `${storeName}で買うもの`,
      isMatchedStore: true,
      items: storeItems,
    });
  }

  if (others.length > 0 || groups.length === 0) {
    groups.push({
      storeKey: '__others__',
      heading: 'その他で買うもの',
      isMatchedStore: false,
      items: others,
    });
  }

  return groups;
}
