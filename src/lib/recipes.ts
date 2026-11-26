// レシピの形と、1人分の栄養の計算。
// 栄養は、材料のg（正味：皮・種・骨などを除いた重さ）と食品成分表の数値から計算する（AIは使わない）。
// 注意：生の数値で計算するので、ゆでこぼし・水さらしで減るカリウムや、残した煮汁の塩分は引いていない
// （実際より多めに出る＝安全側）。
import { foodById } from "./foods";

export type RecipeKind = "主菜" | "副菜" | "汁物" | "主食" | "間食";

/** 病気・症状ごとのコツの種類 */
export type TipKey =
  | "salt" // 減塩（高血圧・心不全・腎臓病など）
  | "water" // 水分の指示がある方（心不全・透析）
  | "potassium" // カリウム（腎臓病）
  | "protein" // たんぱく質（腎臓病）
  | "diabetes" // 糖尿病
  | "cirrhosis" // 肝硬変
  | "soft" // やわらかく・飲み込みやすく
  | "appetite" // 食欲がない
  | "nausea" // 吐き気
  | "stomatitis" // 口内炎
  | "taste" // 味覚の変化
  | "diarrhea" // 下痢
  | "raw"; // 生もの・衛生

export const TIP_LABEL: Record<TipKey, string> = {
  salt: "減塩のコツ",
  water: "水分の指示がある方へ",
  potassium: "カリウムを減らすコツ（腎臓病）",
  protein: "たんぱく質の調整（腎臓病）",
  diabetes: "糖尿病の方へ",
  cirrhosis: "肝硬変の方へ",
  soft: "やわらかく・飲み込みやすく",
  appetite: "食欲がないとき",
  nausea: "吐き気があるとき",
  stomatitis: "口内炎があるとき",
  taste: "味を感じにくいとき",
  diarrhea: "下痢のとき",
  raw: "生もの・衛生",
};

export type Ingredient = {
  /** 食材データの食品番号 */
  foodId: string;
  /** 1人分の正味の重さ（g） */
  grams: number;
  /** 家庭での目安（例：小さじ1、1/4個） */
  label?: string;
  /** 下ごしらえなどの説明（例：せん切り） */
  note?: string;
};

export type Recipe = {
  id: string;
  name: string;
  kana: string;
  kind: RecipeKind;
  minutes: number;
  /** 1人分の材料 */
  ingredients: Ingredient[];
  /** 栄養の計算に入らないもの（水など） */
  extras?: string[];
  steps: string[];
  tips: Partial<Record<TipKey, string>>;
  /** 「生ものを避ける」ときに外すかどうかの印（国立がん研究センター：生肉・刺身・生野菜・発酵食品・ドライフルーツ） */
  flags: {
    rawMeatFish?: boolean;
    rawVeg?: boolean;
    /** 加熱しない発酵食品（納豆・ヨーグルト・キムチなど） */
    fermented?: boolean;
    driedFruit?: boolean;
    /** やわらかい・飲み込みやすい */
    soft?: boolean;
  };
  /** YouTube で探すときの言葉 */
  youtube: string;
};

export type Nutrition = {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  salt: number;
  potassium: number;
  phosphorus: number;
};

/** 1人分の栄養（材料のgから計算） */
export function recipeNutrition(recipe: Pick<Recipe, "ingredients">): Nutrition {
  const sum: Nutrition = { kcal: 0, protein: 0, fat: 0, carb: 0, salt: 0, potassium: 0, phosphorus: 0 };
  for (const ing of recipe.ingredients) {
    const food = foodById(ing.foodId);
    if (!food) throw new Error(`食品番号 ${ing.foodId} が食材データにありません`);
    const r = ing.grams / 100;
    const p = food.per100g;
    sum.kcal += (p.kcal ?? 0) * r;
    sum.protein += (p.protein ?? 0) * r;
    sum.fat += (p.fat ?? 0) * r;
    sum.carb += (p.carb ?? 0) * r;
    sum.salt += (p.salt ?? 0) * r;
    sum.potassium += (p.potassium ?? 0) * r;
    sum.phosphorus += (p.phosphorus ?? 0) * r;
  }
  return sum;
}

/** 画面・資料に出すときの丸め方 */
export function roundNutrition(n: Nutrition): Nutrition {
  return {
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
    carb: Math.round(n.carb * 10) / 10,
    salt: Math.round(n.salt * 10) / 10,
    potassium: Math.round(n.potassium),
    phosphorus: Math.round(n.phosphorus),
  };
}

export function youtubeUrl(recipe: Pick<Recipe, "youtube">): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.youtube)}`;
}

/** 生ものを避けるときに外すレシピか */
export function isRawRecipe(recipe: Pick<Recipe, "flags">): boolean {
  const f = recipe.flags;
  return !!(f.rawMeatFish || f.rawVeg || f.fermented || f.driedFruit);
}
