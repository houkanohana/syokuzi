import { describe, expect, it } from "vitest";
import { RECIPES } from "@/data/recipes";
import type { Person, StockItem } from "./db";
import {
  DEFAULT_MEAL_RATIO,
  anyAvoidRaw,
  checkMeal,
  checkOne,
  findAvailable,
  isValidRatio,
  relevantTips,
  servingsOf,
  suggest,
} from "./plan";
import { NO_CONDITIONS, type Conditions, type TargetResult } from "./targets";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

function stock(foodId: string, expiry: string | null = null): StockItem {
  return { id: 0, foodId, customName: null, storage: "冷蔵", amount: null, unit: null, expiry, createdAt: "", updatedAt: "" };
}

function person(conditions: Partial<Conditions> = {}, over: Partial<Person> = {}): Person {
  return {
    id: 1,
    nickname: "本人",
    age: 70,
    sex: "female",
    heightCm: 150,
    weightKg: 50,
    activity: "normal",
    conditions: { ...NO_CONDITIONS, ...conditions },
    instructions: {},
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("朝・昼・夕の配分", () => {
  it("はじめは 朝30・昼35・夕35%（2026-11-27 決定）で、合計100%", () => {
    expect(DEFAULT_MEAL_RATIO).toEqual({ breakfast: 30, lunch: 35, dinner: 35 });
    expect(isValidRatio(DEFAULT_MEAL_RATIO)).toBe(true);
    expect(isValidRatio({ breakfast: 30, lunch: 30, dinner: 30 })).toBe(false);
  });
});

describe("家にあるか（代用）", () => {
  it("減塩しょうゆがあれば、こいくちしょうゆの代わりになる", () => {
    expect(findAvailable("17007", new Set(["17086"]))).toBe("17086");
    expect(findAvailable("17007", new Set(["17007"]))).toBe("17007");
    expect(findAvailable("17007", new Set(["17045"]))).toBeNull();
  });
});

describe("提案", () => {
  const base = { pantry: [] as string[], avoidRaw: false, softOnly: false, today: "2026-11-27" };

  it("在庫と調味料がそろうと、しょうが焼きは足りないものなし", () => {
    const s = suggest([recipe("r001")], {
      ...base,
      stock: ["11220", "06153", "06103", "06061"].map((id) => stock(id)),
      pantry: ["02034", "17086", "16025", "14006"], // 片栗粉・減塩しょうゆ・みりん・サラダ油
    })[0];
    expect(s.missingMain).toEqual([]);
    expect(s.missingPantry).toEqual([]);
    expect(s.substitutions.map((x) => x.useFoodId)).toEqual(["17086"]);
  });

  it("調味料を登録していなければ、足りない調味料として分けて出す", () => {
    const s = suggest([recipe("r001")], { ...base, stock: ["11220", "06153", "06103", "06061"].map((id) => stock(id)) })[0];
    expect(s.missingMain).toEqual([]);
    expect(s.missingPantry.map((i) => i.foodId)).toEqual(["02034", "17007", "16025", "14006"]);
  });

  it("足りない食材が少ない順、同じなら期限が近い在庫を使う料理が先", () => {
    const list = suggest([recipe("r005"), recipe("r034"), recipe("r001")], {
      ...base,
      stock: [stock("06267"), stock("06233", "2026-11-28")], // ほうれん草・白菜（明日まで）
    });
    expect(list.map((s) => s.recipe.id).slice(0, 2)).toEqual(["r034", "r005"]);
    expect(list[0].usesSoon).toEqual(["06233"]);
  });

  it("生ものを避ける家族がいると、生ものの印がある料理は出さない", () => {
    const ids = suggest(RECIPES, { ...base, stock: [], avoidRaw: true }).map((s) => s.recipe.id);
    expect(ids).not.toContain("r001");
    expect(ids).not.toContain("r006");
    expect(ids).toContain("r009"); // みそ汁は出す（2026-11-27 決定）
  });

  it("やわらかいものだけに絞れる", () => {
    const list = suggest(RECIPES, { ...base, stock: [], softOnly: true });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.recipe.flags.soft)).toBe(true);
  });
});

describe("1食の目安と比べる", () => {
  it("食塩6g未満・朝30% → 1.8g未満。1.8gちょうどは多め、1.7gは大丈夫", () => {
    const t: TargetResult = { status: "value", max: 6, maxExclusive: true, text: "", reasons: [], notes: [] };
    expect(checkOne("salt", t, 30, 1.8).status).toBe("over");
    expect(checkOne("salt", t, 30, 1.7).status).toBe("ok");
    expect(checkOne("salt", t, 30, 1.7).limitText).toBe("1.8g未満");
  });

  it("病院の指示（1日1,600kcalくらい）・夕35% → 560kcalくらい。1割を超えたら多め", () => {
    const t: TargetResult = { status: "instruction", value: 1600, compare: "about", reasons: [] };
    expect(checkOne("energy", t, 35, 610).status).toBe("ok");
    expect(checkOne("energy", t, 35, 620).status).toBe("over");
  });

  it("目安が決まっていない項目は「比べられない」", () => {
    const t: TargetResult = { status: "needInstruction", messages: [], reasons: [] };
    expect(checkOne("salt", t, 35, 1).status).toBe("unknown");
  });

  it("高血圧の人：肉じゃが（1.1g）＋みそ汁（1.1g）＝2.2g は夕食の目安 2.1g未満を超える", () => {
    const [res] = checkMeal([person({ hypertension: true })], [recipe("r004"), recipe("r009")], 35);
    expect(res.overs.map((c) => c.nutrient)).toContain("salt");
  });

  it("家族1人ずつ比べる（病気なしの人は、同じ献立でも多めにならない）", () => {
    const res = checkMeal(
      [person({ hypertension: true }), person({}, { id: 2, nickname: "孫", age: 30, sex: "male", heightCm: 170, weightKg: 65 })],
      [recipe("r004"), recipe("r009")],
      35
    );
    expect(res[0].overs.some((c) => c.nutrient === "salt")).toBe(true);
    expect(res[1].overs.some((c) => c.nutrient === "salt")).toBe(false); // 7.5×0.35=2.6g未満
  });
});

describe("家族に関係するコツ・人数", () => {
  it("腎臓病G3b → 減塩・カリウム・たんぱく質、心不全 → 水分", () => {
    const tips = relevantTips([person({ ckd: "G3b" }), person({ heartFailure: true })]);
    expect([...tips].sort()).toEqual(["potassium", "protein", "salt", "water"].sort());
  });

  it("がんの副作用（口内炎・生ものを避ける）→ 口内炎・やわらか・生もの", () => {
    const p = person({ cancer: { symptoms: ["stomatitis"], avoidRaw: true } });
    expect([...relevantTips([p])].sort()).toEqual(["raw", "soft", "stomatitis"].sort());
    expect(anyAvoidRaw([p])).toBe(true);
  });

  it("何人分：登録2人＋ほか1人＝3人分。だれもいなければ1人分", () => {
    expect(servingsOf([person(), person()], 1)).toBe(3);
    expect(servingsOf([], 0)).toBe(1);
  });
});
