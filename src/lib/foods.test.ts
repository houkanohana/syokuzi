import { describe, expect, it } from "vitest";
import { CATEGORIES, FOODS, foodById, normalize, searchFoods } from "./foods";

describe("食材データ", () => {
  it("300品ほどあり、食品番号が重ならない", () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(280);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });

  it("成分表の値がそのまま入っている（例：卵 100gあたり 142kcal・食塩0.4g、こいくちしょうゆ 食塩14.5g）", () => {
    expect(foodById("12004")?.per100g.kcal).toBe(142);
    expect(foodById("12004")?.per100g.salt).toBe(0.4);
    expect(foodById("17007")?.per100g.salt).toBe(14.5);
  });

  it("分類はすべて画面の並びに入っていて、野菜が最初", () => {
    expect(CATEGORIES[0]).toBe("野菜");
    expect(new Set(CATEGORIES)).toEqual(new Set(FOODS.map((f) => f.category)));
  });

  it("保存場所は 冷蔵・冷凍・常温 のどれか", () => {
    for (const f of FOODS) expect(["冷蔵", "冷凍", "常温"]).toContain(f.storage);
  });
});

describe("検索", () => {
  it("カタカナ・ひらがな・全角どちらでも探せる", () => {
    expect(normalize("キャベツ")).toBe("きゃべつ");
    expect(searchFoods("きゃべつ")[0].name).toBe("キャベツ");
    expect(searchFoods("キャベツ")[0].name).toBe("キャベツ");
  });

  it("よみがなで探せる（「とりむね」で鶏むね）", () => {
    expect(searchFoods("とりむね").map((f) => f.name)).toContain("鶏むね（皮なし）");
  });

  it("先頭が合うものを先に出す（「ねぎ」で長ねぎ・青ねぎ、玉ねぎは後）", () => {
    const names = searchFoods("ねぎ").map((f) => f.name);
    expect(names.indexOf("長ねぎ")).toBeLessThan(names.indexOf("玉ねぎ"));
  });

  it("空のときは何も出さない", () => {
    expect(searchFoods("  ")).toEqual([]);
  });
});
