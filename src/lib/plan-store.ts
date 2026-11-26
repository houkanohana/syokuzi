// 献立まわりの保存（スマホの中）：家にある調味料・朝昼夕の配分・選んだ料理・買い物リスト
import { db, getSetting, setSetting, type ShoppingItem } from "./db";
import { foodById } from "./foods";
import { DEFAULT_MEAL_RATIO, type Meal, type MealRatio } from "./plan";
import type { Ingredient } from "./recipes";
import { addStock } from "./stock";

const PANTRY_KEY = "pantry";
const RATIO_KEY = "mealRatio";
const PLAN_KEY = "plan";

// ---- 家にある調味料（常備品）
export async function getPantry(): Promise<string[]> {
  return (await getSetting<string[]>(PANTRY_KEY)) ?? [];
}
export async function setPantry(ids: string[]): Promise<void> {
  await setSetting(PANTRY_KEY, [...new Set(ids)]);
}
export async function togglePantry(id: string, on: boolean): Promise<void> {
  const cur = await getPantry();
  await setPantry(on ? [...cur, id] : cur.filter((x) => x !== id));
}

// ---- 朝・昼・夕の配分
export async function getMealRatio(): Promise<MealRatio> {
  return (await getSetting<MealRatio>(RATIO_KEY)) ?? DEFAULT_MEAL_RATIO;
}
export async function setMealRatio(r: MealRatio): Promise<void> {
  await setSetting(RATIO_KEY, r);
}

// ---- いま考えている献立（どの食事か・選んだ料理）
export type PlanState = { meal: Meal; selected: string[] };
export const EMPTY_PLAN: PlanState = { meal: "dinner", selected: [] };

export async function getPlan(): Promise<PlanState> {
  return (await getSetting<PlanState>(PLAN_KEY)) ?? EMPTY_PLAN;
}
export async function setPlan(p: PlanState): Promise<void> {
  await setSetting(PLAN_KEY, p);
}
export async function toggleSelected(recipeId: string): Promise<void> {
  const p = await getPlan();
  const selected = p.selected.includes(recipeId)
    ? p.selected.filter((x) => x !== recipeId)
    : [...p.selected, recipeId];
  await setPlan({ ...p, selected });
}

// ---- 買い物リスト
export function shoppingName(item: Pick<ShoppingItem, "foodId" | "customName">): string {
  if (item.foodId) return foodById(item.foodId)?.name ?? "（不明な食材）";
  return item.customName ?? "（名前なし）";
}

/** 足りない食材を買い物リストに足す（同じ食材で、まだ買っていないものがあれば量を足し合わせる） */
export async function addToShopping(items: Ingredient[], servings: number, recipeId: string): Promise<number> {
  let added = 0;
  await db.transaction("rw", db.shopping, async () => {
    for (const ing of items) {
      const grams = Math.round(ing.grams * servings * 10) / 10;
      const existing = await db.shopping.where("foodId").equals(ing.foodId).filter((x) => !x.checked).first();
      if (existing) {
        if (existing.recipeIds.includes(recipeId)) continue;
        await db.shopping.update(existing.id, {
          grams: existing.grams === null ? null : Math.round((existing.grams + grams) * 10) / 10,
          recipeIds: [...existing.recipeIds, recipeId],
        });
      } else {
        await db.shopping.add({
          foodId: ing.foodId,
          customName: null,
          grams,
          checked: false,
          recipeIds: [recipeId],
          createdAt: new Date().toISOString(),
        } as Omit<ShoppingItem, "id"> as ShoppingItem);
      }
      added++;
    }
  });
  return added;
}

export async function addCustomShopping(foodId: string | null, customName: string | null): Promise<void> {
  await db.shopping.add({
    foodId,
    customName,
    grams: null,
    checked: false,
    recipeIds: [] as string[],
    createdAt: new Date().toISOString(),
  } as Omit<ShoppingItem, "id"> as ShoppingItem);
}

/** チェックした（買った）ものを在庫に入れて、買い物リストから消す。調味料は「家にある調味料」に入れる */
export async function moveCheckedToStock(pantryCategories: string[]): Promise<number> {
  const checked = await db.shopping.filter((x) => x.checked).toArray();
  for (const it of checked) {
    const food = it.foodId ? foodById(it.foodId) : undefined;
    if (food && pantryCategories.includes(food.category)) {
      await togglePantry(food.id, true);
    } else {
      await addStock({
        foodId: food ? food.id : null,
        customName: food ? null : it.customName,
        storage: food?.storage ?? "冷蔵",
        amount: null,
        unit: null,
        expiry: null,
      });
    }
    await db.shopping.delete(it.id);
  }
  return checked.length;
}
