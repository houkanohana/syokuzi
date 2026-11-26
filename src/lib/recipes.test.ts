import { describe, expect, it } from "vitest";
import { RECIPES } from "@/data/recipes";
import { foodById } from "./foods";
import { isRawRecipe, recipeNutrition, youtubeUrl } from "./recipes";

describe("レシピ集のきまり", () => {
  it("レシピの番号が重ならない", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("材料はすべて食材データにある", () => {
    for (const r of RECIPES) for (const i of r.ingredients) expect(foodById(i.foodId), `${r.name}：${i.foodId}`).toBeDefined();
  });

  it("どのレシピも減塩の範囲（1人分：主菜1.5g・副菜0.8g・汁物1.2g・主食1.0g 以下）", () => {
    const limit = { 主菜: 1.5, 副菜: 0.8, 汁物: 1.2, 主食: 1.0, 間食: 0.5 };
    for (const r of RECIPES) {
      expect(recipeNutrition(r).salt, r.name).toBeLessThanOrEqual(limit[r.kind]);
    }
  });

  it("手順・YouTube検索の言葉がある", () => {
    for (const r of RECIPES) {
      expect(r.steps.length, r.name).toBeGreaterThan(0);
      expect(youtubeUrl(r)).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
    }
  });
});

describe("栄養の計算が手計算と合う", () => {
  it("ほうれん草のごまあえ（ほうれん草60g・いりごま3g・砂糖2g・しょうゆ3g）", () => {
    const r = RECIPES.find((x) => x.id === "r005")!;
    const n = recipeNutrition(r);
    // 手計算（成分表の100gあたりの値 × g/100 の合計）
    // カロリー：18×0.6 + 605×0.03 + 391×0.02 + 76×0.03 = 39.05
    expect(n.kcal).toBeCloseTo(39.05, 2);
    // 食塩：しょうゆ 14.5×0.03 = 0.435
    expect(n.salt).toBeCloseTo(0.435, 3);
    // カリウム：690×0.6 + 410×0.03 + 2×0.02 + 390×0.03 = 438.04
    expect(n.potassium).toBeCloseTo(438.04, 2);
    // リン：47×0.6 + 560×0.03 + 0 + 160×0.03 = 49.8
    expect(n.phosphorus).toBeCloseTo(49.8, 2);
    // たんぱく質：2.2×0.6 + 20.3×0.03 + 0 + 7.7×0.03 = 2.16
    expect(n.protein).toBeCloseTo(2.16, 2);
  });
});

describe("生もの", () => {
  it("生野菜を使う料理には印がつき、加熱した料理にはつかない", () => {
    expect(isRawRecipe(RECIPES.find((x) => x.id === "r006")!)).toBe(true); // 酢の物
    expect(isRawRecipe(RECIPES.find((x) => x.id === "r010")!)).toBe(false); // 卵がゆ
  });
});
