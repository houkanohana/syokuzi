import type { InventoryItem, StockLevel, StorageLocation } from '../types';

export const STORAGE_TABS: {
  id: StorageLocation;
  label: string;
  hint: string;
}[] = [
  { id: 'fridge', label: '冷蔵庫', hint: '肉・魚・野菜・卵・豆腐など' },
  { id: 'freezer', label: '冷凍庫', hint: '冷凍野菜・うどん・肉魚ストック' },
  { id: 'pantry', label: '常温', hint: '米・乾物・調味料・缶詰など' },
];

export const STOCK_LEVEL_META: Record<
  StockLevel,
  { label: string; colorClass: string; dotClass: string; next: StockLevel }
> = {
  plenty: {
    label: 'たっぷり',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    next: 'half',
  },
  half: {
    label: '半分',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
    next: 'low',
  },
  low: {
    label: '少し',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    next: 'plenty',
  },
};

export const QUICK_ADD_SUGGESTIONS: Record<StorageLocation, string[]> = {
  fridge: ['豚こま肉', '鮭切り身', 'キャベツ', 'ほうれん草', '大根', 'きのこ', '長ねぎ', '牛乳'],
  freezer: ['冷凍うどん', '冷凍ブロッコリー', '鶏もも肉', '白身魚', 'むきえび', 'ごはん'],
  pantry: ['白米', 'みそ', 'みりん', '料理酒', '片栗粉', 'ごま油', 'ツナ缶', 'だしパック'],
};

export function createSampleInventory(): InventoryItem[] {
  const now = new Date().toISOString();
  return [
    // 冷蔵庫
    {
      id: 'sample-1',
      name: '鶏むね肉',
      location: 'fridge',
      quantityText: '1枚（約300g）',
      stockLevel: 'plenty',
      updatedAt: now,
    },
    {
      id: 'sample-2',
      name: '卵',
      location: 'fridge',
      quantityText: '6個',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-3',
      name: '絹ごし豆腐',
      location: 'fridge',
      quantityText: '1丁（300g）',
      stockLevel: 'plenty',
      updatedAt: now,
    },
    {
      id: 'sample-4',
      name: 'にんじん',
      location: 'fridge',
      quantityText: '1本',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-5',
      name: '白菜',
      location: 'fridge',
      quantityText: '1/4カット',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-6',
      name: 'しょうが',
      location: 'fridge',
      quantityText: '1かけ',
      stockLevel: 'low',
      updatedAt: now,
    },
    // 冷凍庫
    {
      id: 'sample-7',
      name: '冷凍ブロッコリー',
      location: 'freezer',
      quantityText: '1袋',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-8',
      name: '冷凍うどん',
      location: 'freezer',
      quantityText: '2玉',
      stockLevel: 'plenty',
      updatedAt: now,
    },
    {
      id: 'sample-9',
      name: '白身魚（たら切り身）',
      location: 'freezer',
      quantityText: '2切れ',
      stockLevel: 'half',
      updatedAt: now,
    },
    // 常温
    {
      id: 'sample-10',
      name: '玉ねぎ',
      location: 'pantry',
      quantityText: '2個',
      stockLevel: 'plenty',
      updatedAt: now,
    },
    {
      id: 'sample-11',
      name: '醤油',
      location: 'pantry',
      quantityText: '1本',
      stockLevel: 'plenty',
      updatedAt: now,
    },
    {
      id: 'sample-12',
      name: 'だしパック',
      location: 'pantry',
      quantityText: '5袋',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-13',
      name: '片栗粉',
      location: 'pantry',
      quantityText: '1袋',
      stockLevel: 'half',
      updatedAt: now,
    },
    {
      id: 'sample-14',
      name: '白米',
      location: 'pantry',
      quantityText: '2kg',
      stockLevel: 'plenty',
      updatedAt: now,
    },
  ];
}
