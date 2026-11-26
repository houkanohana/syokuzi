// 献立の提案と、1食の目安との比べ方。
// - 足りない食材は「在庫」と「家にある調味料（常備品）」から判断する
// - 1食の目安は、1日の目安 × 朝・昼・夕の配分（2026-11-27 決定：はじめは 朝30・昼35・夕35%）
import type { Person, StockItem } from "./db";
import { foodById } from "./foods";
import type { Ingredient, Nutrition, Recipe, TipKey } from "./recipes";
import { isRawRecipe, recipeNutrition } from "./recipes";
import { expiryLevel } from "./stock";
import { COMPARE_LABEL, NUTRIENT_INFO, computeTargets, type Nutrient, type TargetResult } from "./targets";

// ---------------------------------------------------------------------------
// 朝・昼・夕

export type Meal = "breakfast" | "lunch" | "dinner";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner"];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: "朝", lunch: "昼", dinner: "夕" };
export type MealRatio = Record<Meal, number>;
/** 2026-11-27 依頼者の決定（あとから「わたし・家族」の画面で変えられる） */
export const DEFAULT_MEAL_RATIO: MealRatio = { breakfast: 30, lunch: 35, dinner: 35 };

export function isValidRatio(r: MealRatio): boolean {
  return MEALS.every((m) => Number.isFinite(r[m]) && r[m] > 0) && MEALS.reduce((s, m) => s + r[m], 0) === 100;
}

// ---------------------------------------------------------------------------
// 調味料（常備品）と代用

/** 「調味料（常備品）」として、在庫とは別にチェックで登録する分類 */
export const PANTRY_CATEGORIES = ["調味料", "油", "粉"];

export function isPantryFood(foodId: string): boolean {
  const f = foodById(foodId);
  return !!f && PANTRY_CATEGORIES.includes(f.category);
}

/** 代わりに使える食材の組（同じ組の中なら「ある」とみなす） */
export const ALTERNATIVES: string[][] = [
  ["17007", "17086", "17008"], // しょうゆ（こいくち・減塩・うすくち）
  ["17045", "17046", "17044", "17145"], // みそ
  ["17012", "17146"], // 塩
  ["03003", "03004"], // 砂糖（上白糖・三温糖）
  ["17015", "17016"], // 酢
  ["14006", "14001"], // サラダ油・オリーブ油
  ["11220", "11219"], // 鶏むね（皮なし・皮つき）
  ["11224", "11221"], // 鶏もも（皮なし・皮つき）
  ["06182", "06183"], // トマト・ミニトマト
];

const ALT_INDEX = new Map<string, string[]>();
for (const group of ALTERNATIVES) for (const id of group) ALT_INDEX.set(id, group);

/** 家にあるか：同じ食材、なければ代わりに使える食材。見つかった食品番号を返す（なければ null） */
export function findAvailable(foodId: string, have: Set<string>): string | null {
  if (have.has(foodId)) return foodId;
  for (const alt of ALT_INDEX.get(foodId) ?? []) if (have.has(alt)) return alt;
  return null;
}

// ---------------------------------------------------------------------------
// 提案

export type Suggestion = {
  recipe: Recipe;
  /** 足りない食材（調味料以外） */
  missingMain: Ingredient[];
  /** 足りない調味料・油・粉 */
  missingPantry: Ingredient[];
  /** 代わりの食材で作れるもの */
  substitutions: { ingredient: Ingredient; useFoodId: string }[];
  /** 期限が近い・過ぎた在庫を使う食材 */
  usesSoon: string[];
};

export type SuggestOptions = {
  stock: StockItem[];
  pantry: string[];
  /** 生ものを外す（家族の誰かが「生ものを避ける」） */
  avoidRaw: boolean;
  softOnly: boolean;
  today: string;
};

export function suggest(recipes: Recipe[], o: SuggestOptions): Suggestion[] {
  const stockIds = new Set(o.stock.flatMap((s) => (s.foodId ? [s.foodId] : [])));
  const have = new Set([...stockIds, ...o.pantry]);
  const soon = new Set(
    o.stock.flatMap((s) => (s.foodId && expiryLevel(s.expiry, o.today) !== "ok" && s.expiry ? [s.foodId] : []))
  );

  const out: Suggestion[] = [];
  for (const recipe of recipes) {
    if (o.avoidRaw && isRawRecipe(recipe)) continue;
    if (o.softOnly && !recipe.flags.soft) continue;
    const s: Suggestion = { recipe, missingMain: [], missingPantry: [], substitutions: [], usesSoon: [] };
    for (const ing of recipe.ingredients) {
      const found = findAvailable(ing.foodId, have);
      if (found === null) {
        (isPantryFood(ing.foodId) ? s.missingPantry : s.missingMain).push(ing);
      } else {
        if (found !== ing.foodId) s.substitutions.push({ ingredient: ing, useFoodId: found });
        if (soon.has(found)) s.usesSoon.push(found);
      }
    }
    out.push(s);
  }
  out.sort(
    (a, b) =>
      a.missingMain.length - b.missingMain.length ||
      b.usesSoon.length - a.usesSoon.length ||
      a.missingPantry.length - b.missingPantry.length ||
      a.recipe.id.localeCompare(b.recipe.id)
  );
  return out;
}

// ---------------------------------------------------------------------------
// 1食の目安と比べる

export const CHECK_NUTRIENTS: Exclude<Nutrient, "water">[] = ["energy", "protein", "salt", "potassium", "phosphorus"];

export type MealCheck = {
  nutrient: Exclude<Nutrient, "water">;
  status: "ok" | "over" | "unknown" | "none";
  /** 料理の合計 */
  value: number;
  /** 1食の目安の言葉（例：「2.1g未満」） */
  limitText: string;
};

const NUTRITION_KEY: Record<Exclude<Nutrient, "water">, keyof Nutrition> = {
  energy: "kcal",
  protein: "protein",
  salt: "salt",
  potassium: "potassium",
  phosphorus: "phosphorus",
};

function fmt(n: number, nutrient: Nutrient) {
  const digits = nutrient === "salt" || nutrient === "protein" ? 1 : 0;
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** 1つの栄養素について、1日の目安 × 配分(%) と比べる */
export function checkOne(
  nutrient: Exclude<Nutrient, "water">,
  target: TargetResult,
  ratioPercent: number,
  value: number
): MealCheck {
  const r = ratioPercent / 100;
  const unit = NUTRIENT_INFO[nutrient].unit;
  const base = { nutrient, value };
  switch (target.status) {
    case "instruction": {
      const lim = target.value * r;
      if (target.compare === "ge") return { ...base, status: "none", limitText: `${fmt(lim, nutrient)}${unit}以上` };
      if (target.compare === "about") {
        return { ...base, status: value > lim * 1.1 ? "over" : "ok", limitText: `${fmt(lim, nutrient)}${unit}くらい` };
      }
      const over = target.compare === "lt" ? value >= lim : value > lim;
      return { ...base, status: over ? "over" : "ok", limitText: `${fmt(lim, nutrient)}${unit}${COMPARE_LABEL[target.compare]}` };
    }
    case "value": {
      if (target.max === undefined) return { ...base, status: "none", limitText: "" };
      const lim = target.max * r;
      if (target.min !== undefined && target.min === target.max) {
        // 「くらい」の目安（例：病気なしのカロリー）は、1割を超えたら多め
        return { ...base, status: value > lim * 1.1 ? "over" : "ok", limitText: `${fmt(lim, nutrient)}${unit}くらい` };
      }
      const over = target.maxExclusive ? value >= lim : value > lim;
      return {
        ...base,
        status: over ? "over" : "ok",
        limitText: `${fmt(lim, nutrient)}${unit}${target.maxExclusive ? "未満" : "以下"}`,
      };
    }
    case "needInstruction":
    case "missing":
      return { ...base, status: "unknown", limitText: "目安が決まっていません" };
    default:
      return { ...base, status: "none", limitText: "" };
  }
}

export type PersonMealCheck = { person: Person; checks: MealCheck[]; overs: MealCheck[] };

/** 選んだ料理（1人分ずつ食べる）の合計を、家族1人ずつの1食の目安と比べる */
export function checkMeal(people: Person[], recipes: Recipe[], ratioPercent: number): PersonMealCheck[] {
  const total: Nutrition = { kcal: 0, protein: 0, fat: 0, carb: 0, salt: 0, potassium: 0, phosphorus: 0 };
  for (const r of recipes) {
    const n = recipeNutrition(r);
    for (const k of Object.keys(total) as (keyof Nutrition)[]) total[k] += n[k];
  }
  return people.map((person) => {
    const t = computeTargets(person);
    const checks = CHECK_NUTRIENTS.map((n) => checkOne(n, t.results[n], ratioPercent, total[NUTRITION_KEY[n]]));
    return { person, checks, overs: checks.filter((c) => c.status === "over") };
  });
}

// ---------------------------------------------------------------------------
// 家族に関係するコツ

export function relevantTips(people: Person[]): Set<TipKey> {
  const s = new Set<TipKey>();
  for (const p of people) {
    const c = p.conditions;
    if (c.hypertension || c.heartFailure || c.ckd || c.diabetes || c.cirrhosis) s.add("salt");
    if (c.heartFailure || c.ckd === "HD" || c.ckd === "PD") s.add("water");
    if (c.ckd && !["G1", "G2", "G3a", "PD"].includes(c.ckd)) s.add("potassium");
    if (c.ckd) s.add("protein");
    if (c.diabetes) s.add("diabetes");
    if (c.cirrhosis) s.add("cirrhosis");
    if (c.cancer) {
      const map = { appetite: "appetite", nausea: "nausea", stomatitis: "stomatitis", taste: "taste", diarrhea: "diarrhea" } as const;
      for (const sym of c.cancer.symptoms) s.add(map[sym]);
      if (c.cancer.symptoms.includes("stomatitis")) s.add("soft");
      if (c.cancer.avoidRaw) s.add("raw");
    }
  }
  return s;
}

/** 家族の誰かが「生ものを避ける」 */
export function anyAvoidRaw(people: Person[]): boolean {
  return people.some((p) => p.conditions.cancer?.avoidRaw);
}

/** 何人分（登録した人＋登録していない人。最低1人） */
export function servingsOf(people: Person[], extra: number): number {
  return Math.max(1, people.length + extra);
}
