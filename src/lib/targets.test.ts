// 目安値の計算が docs/目安値の案.md のとおりになっているかを確かめるテスト。
// `npm test` で動く。
import { describe, expect, it } from "vitest";
import {
  NO_CONDITIONS,
  computeTargets,
  formatTarget,
  type Conditions,
  type TargetInput,
} from "./targets";

type PersonOver = Partial<Omit<TargetInput, "conditions">> & { conditions?: Partial<Conditions> };

function person(over: PersonOver = {}): TargetInput {
  return {
    age: 50,
    sex: "male",
    heightCm: 170,
    weightKg: 65,
    activity: "normal",
    instructions: {},
    ...over,
    conditions: { ...NO_CONDITIONS, ...(over.conditions ?? {}) },
  };
}

const text = (input: TargetInput) => {
  const out = computeTargets(input);
  return {
    out,
    energy: formatTarget("energy", out.results.energy),
    protein: formatTarget("protein", out.results.protein),
    salt: formatTarget("salt", out.results.salt),
    potassium: formatTarget("potassium", out.results.potassium),
    phosphorus: formatTarget("phosphorus", out.results.phosphorus),
    water: formatTarget("water", out.results.water),
  };
};

describe("病気なし（国の目安）", () => {
  it("40歳男性・65kg・ふつう：カロリーは 39.4kcal×65kg、食塩7.5g未満、カリウム3,000mg以上", () => {
    const t = text(person({ age: 40, weightKg: 65 }));
    expect(t.energy).toBe("2,560kcalくらい"); // 39.4×65=2561
    expect(t.salt).toBe("7.5g未満");
    expect(t.potassium).toBe("3,000mg以上");
    expect(t.protein).toBe("目安なし");
    expect(t.water).toBe("目安なし");
  });

  it("80歳女性・活動量「高い」は表に無いので「ふつう」で計算し、そのことを知らせる", () => {
    const t = text(person({ age: 80, sex: "female", heightCm: 150, weightKg: 45, activity: "high" }));
    expect(t.energy).toBe("1,580kcalくらい"); // 35.2×45=1584
    expect(t.salt).toBe("6.5g未満");
    const r = t.out.results.energy;
    expect(r.status === "value" && r.notes.some((n) => n.includes("ふつう"))).toBe(true);
  });

  it("8歳男の子：食塩5.0g未満、カリウム2,000mg以上（子どもの表）", () => {
    const t = text(person({ age: 8, heightCm: 128, weightKg: 26 }));
    expect(t.salt).toBe("5g未満");
    expect(t.potassium).toBe("2,000mg以上");
    expect(t.energy).toBe("1,700kcalくらい"); // 65.3×26=1697.8
  });

  it("年齢が無いと計算しない", () => {
    const t = text(person({ age: null }));
    expect(t.salt).toBe("年齢を入れると計算します");
  });
});

describe("高血圧・糖尿病", () => {
  it("高血圧：食塩6g未満", () => {
    expect(text(person({ conditions: { hypertension: true } })).salt).toBe("6g未満");
  });

  it("糖尿病：カロリーは数値を出さず指示をお願いする。食塩は6g未満", () => {
    const t = text(person({ conditions: { diabetes: true } }));
    expect(t.out.results.energy.status).toBe("needInstruction");
    expect(t.salt).toBe("6g未満");
  });

  it("糖尿病で病院の指示（1,600kcal）を入れると、それを使う", () => {
    const t = text(
      person({ conditions: { diabetes: true }, instructions: { energy: { value: 1600, compare: "about" } } })
    );
    expect(t.out.results.energy.status).toBe("instruction");
    expect(t.energy).toBe("1,600kcalくらい");
  });

  it("病院の指示（食塩5g未満）は、高血圧の6g未満より優先", () => {
    const t = text(
      person({ conditions: { hypertension: true }, instructions: { salt: { value: 5, compare: "lt" } } })
    );
    expect(t.salt).toBe("5g未満");
  });
});

describe("心不全", () => {
  it("心不全だけ：食塩は初期値なし（指示をお願い）、水分は制限なし、たんぱく質は1.1g/kg以上", () => {
    const t = text(person({ age: 60, weightKg: 60, conditions: { heartFailure: true } }));
    expect(t.out.results.salt.status).toBe("needInstruction");
    expect(t.water).toBe("制限なし（医師の指示があれば入力）");
    expect(t.protein).toBe("66g以上");
  });

  it("心不全＋高血圧：食塩は高血圧の6g未満を使い、心不全の指示の入力も促す", () => {
    const t = text(person({ conditions: { heartFailure: true, hypertension: true } }));
    expect(t.salt).toBe("6g未満");
    const r = t.out.results.salt;
    expect(r.status === "value" && r.notes.some((n) => n.includes("心不全"))).toBe(true);
  });

  it("心不全・70歳：たんぱく質は 1.2〜1.5g/kg", () => {
    const t = text(person({ age: 70, weightKg: 50, conditions: { heartFailure: true } }));
    expect(t.protein).toBe("60〜75g");
  });
});

describe("腎臓病", () => {
  it("G3b・160cm：標準体重56.3kgで計算", () => {
    const t = text(person({ heightCm: 160, weightKg: 60, conditions: { ckd: "G3b" } }));
    expect(t.out.standardWeight).toBe(56.3);
    expect(t.energy).toBe("1,410〜1,970kcal"); // 25〜35 × 56.3
    expect(t.protein).toBe("34〜45g"); // 0.6〜0.8 × 56.3
    expect(t.salt).toBe("3g以上 6g未満");
    expect(t.potassium).toBe("2,000mg以下");
    expect(t.phosphorus).toBe("数値の目安なし（たんぱく質の量と血液検査で判断）");
  });

  it("G3a：カリウムは制限なし（「多くとる」も出さない）、たんぱく質は0.8〜1.0g/kg", () => {
    const t = text(person({ heightCm: 160, conditions: { ckd: "G3a" } }));
    expect(t.potassium).toBe("制限なし");
    expect(t.protein).toBe("45〜56g");
  });

  it("G4：カリウム1,500mg以下", () => {
    expect(text(person({ conditions: { ckd: "G4" } })).potassium).toBe("1,500mg以下");
  });

  it("高血圧＋G3b：食塩は3g以上6g未満、カリウム2,000mg以下", () => {
    const t = text(person({ conditions: { hypertension: true, ckd: "G3b" } }));
    expect(t.salt).toBe("3g以上 6g未満");
    expect(t.potassium).toBe("2,000mg以下");
  });

  it("ステージ不明：腎臓病に関わる数値はすべて出さず、ステージの確認をお願いする", () => {
    const t = text(person({ conditions: { ckd: "unknown" } }));
    for (const n of ["energy", "protein", "salt", "potassium", "phosphorus", "water"] as const) {
      expect(t.out.results[n].status).toBe("needInstruction");
    }
    expect(t.out.notices.some((n) => n.includes("ステージ"))).toBe(true);
  });

  it("血液透析・170cm：たんぱく質0.9〜1.2g/kg、リンはたんぱく質×15、水分は指示をお願い", () => {
    const t = text(person({ conditions: { ckd: "HD" } }));
    expect(t.out.standardWeight).toBe(63.6);
    expect(t.protein).toBe("57〜76g");
    expect(t.phosphorus).toBe("1,140mg以下"); // 76×15
    expect(t.salt).toBe("6g未満");
    expect(t.potassium).toBe("2,000mg以下");
    expect(t.out.results.water.status).toBe("needInstruction");
  });

  it("血液透析でたんぱく質の指示（60g）を入れると、リンは900mg以下", () => {
    const t = text(person({ conditions: { ckd: "HD" }, instructions: { protein: { value: 60, compare: "about" } } }));
    expect(t.phosphorus).toBe("900mg以下");
  });

  it("腹膜透析：食塩と水分は指示をお願い、カリウムは制限なし", () => {
    const t = text(person({ conditions: { ckd: "PD" } }));
    expect(t.out.results.salt.status).toBe("needInstruction");
    expect(t.out.results.water.status).toBe("needInstruction");
    expect(t.potassium).toBe("制限なし");
  });

  it("身長が無いと、腎臓病のカロリーは計算しない", () => {
    const t = text(person({ heightCm: null, conditions: { ckd: "G3b" } }));
    expect(t.out.results.energy.status).toBe("missing");
  });
});

describe("病気が重なったとき：たんぱく質の向きが逆", () => {
  it("腎臓病G3b＋心不全：たんぱく質は自動で決めず、指示をお願いする", () => {
    const t = text(person({ conditions: { ckd: "G3b", heartFailure: true } }));
    expect(t.out.results.protein.status).toBe("needInstruction");
  });

  it("腎臓病G3b＋肝硬変：たんぱく質は自動で決めない", () => {
    const t = text(person({ conditions: { ckd: "G3b", cirrhosis: "no" } }));
    expect(t.out.results.protein.status).toBe("needInstruction");
  });
});

describe("肝硬変", () => {
  it("腹水あり：食塩5〜7g、カロリーは指示をお願い、たんぱく質は「極端に減らさない」", () => {
    const t = text(person({ conditions: { cirrhosis: "yes" } }));
    expect(t.salt).toBe("5〜7g");
    expect(t.out.results.energy.status).toBe("needInstruction");
    expect(t.protein).toBe("極端に減らさない");
  });

  it("腹水あり＋高血圧：食塩は5g以上6g未満（いちばん厳しい上限）", () => {
    const t = text(person({ conditions: { cirrhosis: "yes", hypertension: true } }));
    expect(t.salt).toBe("5g以上 6g未満");
  });

  it("腹水なし：食塩は国の目安（7.5g未満）に「控えめに」を添える", () => {
    const t = text(person({ conditions: { cirrhosis: "no" } }));
    expect(t.salt).toBe("7.5g未満");
    const r = t.out.results.salt;
    expect(r.status === "value" && r.notes.some((n) => n.includes("控えめ"))).toBe(true);
  });
});

describe("ダイエット", () => {
  it("BMI 28（170cm・81kg・45歳）：25kcal×標準体重 以下", () => {
    const t = text(person({ age: 45, weightKg: 81, conditions: { diet: true } }));
    expect(t.out.bmi).toBe(28);
    expect(t.energy).toBe("1,590kcal以下"); // 25×63.6=1590
  });

  it("BMI 36：20〜25kcal×標準体重", () => {
    const t = text(person({ age: 45, weightKg: 104, conditions: { diet: true } }));
    expect(t.energy).toBe("1,270〜1,590kcal");
  });

  it("BMI 22：減量の計算はせず、国の目安とお知らせ", () => {
    const t = text(person({ age: 45, weightKg: 64, conditions: { diet: true } }));
    expect(t.energy).toBe("2,520kcalくらい"); // 39.4×64
    expect(t.out.notices.some((n) => n.includes("BMIが25未満"))).toBe(true);
  });

  it("70歳：減量の計算はしない", () => {
    const t = text(person({ age: 70, weightKg: 85, conditions: { diet: true } }));
    expect(t.energy).toBe("3,120kcalくらい"); // 36.7×85
    expect(t.out.notices.some((n) => n.includes("65歳以上"))).toBe(true);
  });

  it("ダイエット＋腎臓病：減量の計算はせず、腎臓病の目安を使う", () => {
    const t = text(person({ age: 45, weightKg: 81, conditions: { diet: true, ckd: "G3a" } }));
    expect(t.energy).toBe("1,590〜2,230kcal"); // 25〜35×63.6
  });
});

describe("お子さん", () => {
  it("8歳で高血圧：病気の目安は出さず指示をお願いする", () => {
    const t = text(person({ age: 8, heightCm: 128, weightKg: 26, conditions: { hypertension: true } }));
    expect(t.out.results.salt.status).toBe("needInstruction");
    expect(t.out.notices.some((n) => n.includes("お子さん"))).toBe(true);
  });
});

describe("がんの副作用", () => {
  it("数値は変えず、「生ものを外す」のお知らせを出す", () => {
    const t = text(person({ conditions: { cancer: { symptoms: ["stomatitis"], avoidRaw: true } } }));
    expect(t.salt).toBe("7.5g未満");
    expect(t.out.notices.some((n) => n.includes("生もの"))).toBe(true);
  });
});
