// 食材データ（src/data/foods.json）の読み出しと検索。
// データは scripts/build-foods.py が国の食品成分表から作る。手で直さない。
import data from "@/data/foods.json";

export type Storage = "冷蔵" | "冷凍" | "常温";
export const STORAGES: Storage[] = ["冷蔵", "冷凍", "常温"];

export type Food = {
  id: string;
  name: string;
  kana: string;
  category: string;
  storage: Storage;
  official: string;
  refuse: number | null;
  per100g: {
    kcal: number | null;
    protein: number | null;
    fat: number | null;
    carb: number | null;
    fiber: number | null;
    salt: number | null;
    potassium: number | null;
    phosphorus: number | null;
    water: number | null;
  };
};

export const FOODS = data.foods as Food[];
export const FOOD_SOURCE: string = data.source;

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export function foodById(id: string): Food | undefined {
  return BY_ID.get(id);
}

/** 分類の並び（画面に出す順）。ここに無い分類は最後に付け足す */
const CATEGORY_ORDER = [
  "野菜", "いも", "きのこ", "海藻", "果物", "肉", "魚介", "卵", "豆・大豆製品", "乳製品",
  "ごはん・パン・めん", "粉", "調味料", "油", "種実", "漬物", "飲み物", "おかず", "お菓子",
];
export const CATEGORIES: string[] = [
  ...CATEGORY_ORDER.filter((c) => FOODS.some((f) => f.category === c)),
  ...[...new Set(FOODS.map((f) => f.category))].filter((c) => !CATEGORY_ORDER.includes(c)),
];

/** 検索用に文字をそろえる：全角英数→半角、カタカナ→ひらがな、空白を消す、小文字に */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "")
    .toLowerCase();
}

const INDEX = FOODS.map((f) => ({
  food: f,
  name: normalize(f.name),
  words: f.kana.split(/\s+/).map(normalize),
}));

/** 呼び名・よみがなで探す。先頭が合うものを先に並べる */
export function searchFoods(query: string, limit = 30): Food[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const it of INDEX) {
    let score = -1;
    if (it.name.startsWith(q) || it.words.some((w) => w.startsWith(q))) score = 2;
    else if (it.name.includes(q) || it.words.some((w) => w.includes(q))) score = 1;
    if (score >= 0) scored.push({ food: it.food, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.food);
}
