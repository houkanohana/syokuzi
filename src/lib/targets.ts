// 1日の目安値の計算。仕様は docs/目安値の案.md（2026-11-26 依頼者の決定を含む）。
//
// 考え方：
// 1. 病気・症状ごとに「きまり（Rule）」を作る
// 2. 栄養素ごとに、きまりを合わせて1つの答えにする
//    - 病院の指示が入っていれば、それがいちばん優先
//    - 「数値を出さない」きまり（block）が1つでもあれば、数値を出さず指示の入力をお願いする
//    - 上限は、いちばん厳しい（小さい）ものを使う
//    - たんぱく質は、腎臓病（減らす）と心不全・肝硬変（減らしすぎない）で向きが逆なので、両方あれば指示をお願いする
// 3. 病気のきまりが無い栄養素は、国の食事摂取基準（病気なしの目安）を使う
import {
  EER_PER_KG,
  POTASSIUM_GOAL,
  SALT_GOAL,
  ageBandIndex,
  type Activity,
  type Sex,
  type SourceId,
} from "./targets-data";

export type { Activity, Sex, SourceId };

export type CkdStage = "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5" | "HD" | "PD" | "unknown";
export type Ascites = "yes" | "no" | "unknown";
export type CancerSymptom = "appetite" | "nausea" | "stomatitis" | "taste" | "diarrhea";

export type Conditions = {
  hypertension: boolean;
  diabetes: boolean;
  heartFailure: boolean;
  /** 腎臓病のステージ。選んでいなければ null */
  ckd: CkdStage | null;
  /** 肝硬変の腹水。選んでいなければ null */
  cirrhosis: Ascites | null;
  /** 抗がん剤などの副作用。選んでいなければ null */
  cancer: { symptoms: CancerSymptom[]; avoidRaw: boolean } | null;
  diet: boolean;
};

export const NO_CONDITIONS: Conditions = {
  hypertension: false,
  diabetes: false,
  heartFailure: false,
  ckd: null,
  cirrhosis: null,
  cancer: null,
  diet: false,
};

export type Nutrient = "energy" | "protein" | "salt" | "potassium" | "phosphorus" | "water";
export const NUTRIENTS: Nutrient[] = ["energy", "protein", "salt", "potassium", "phosphorus", "water"];

export const NUTRIENT_INFO: Record<Nutrient, { label: string; unit: string }> = {
  energy: { label: "カロリー", unit: "kcal" },
  protein: { label: "たんぱく質", unit: "g" },
  salt: { label: "食塩", unit: "g" },
  potassium: { label: "カリウム", unit: "mg" },
  phosphorus: { label: "リン", unit: "mg" },
  water: { label: "水分", unit: "mL" },
};

/** 病院の指示の比べ方 */
export type Compare = "lt" | "le" | "ge" | "about";
export const COMPARE_LABEL: Record<Compare, string> = {
  lt: "未満",
  le: "以下",
  ge: "以上",
  about: "くらい",
};
export const DEFAULT_COMPARE: Record<Nutrient, Compare> = {
  energy: "about",
  protein: "about",
  salt: "lt",
  potassium: "le",
  phosphorus: "le",
  water: "le",
};

export type Instruction = { value: number; compare: Compare };

export type PersonBody = {
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: Activity;
};

export type TargetInput = PersonBody & {
  conditions: Conditions;
  instructions: Partial<Record<Nutrient, Instruction>>;
};

/** どの病気（または「病気なし」）から来たきまりか、の説明 */
export type Reason = { label: string; detail: string; source?: SourceId };

export type TargetResult =
  /** 病院の指示を使う */
  | { status: "instruction"; value: number; compare: Compare; reasons: Reason[] }
  /** 数値の目安 */
  | {
      status: "value";
      min?: number;
      max?: number;
      /** true なら max は「未満」、false なら「以下」 */
      maxExclusive?: boolean;
      text: string;
      reasons: Reason[];
      notes: string[];
    }
  /** 数値はないが、ことばの目安がある（例：制限なし、過剰な摂取をしない） */
  | { status: "text"; text: string; reasons: Reason[]; notes: string[] }
  /** 数値を出さず、病院の指示の入力をお願いする */
  | { status: "needInstruction"; messages: string[]; reasons: Reason[] }
  /** 身長・体重などが足りず計算できない */
  | { status: "missing"; message: string }
  /** 目安なし */
  | { status: "none" };

export type TargetsOutput = {
  bmi: number | null;
  standardWeight: number | null;
  results: Record<Nutrient, TargetResult>;
  /** 画面の上に出すお知らせ */
  notices: string[];
};

// ---------------------------------------------------------------------------
// きまり（Rule）

type Direction = "limit" | "secure"; // limit＝減らす向き、secure＝減らしすぎない向き（たんぱく質で使う）

type Rule =
  | {
      kind: "num";
      min?: number;
      max?: number;
      maxExclusive?: boolean;
      text: string;
      reason: Reason;
      direction?: Direction;
      note?: string;
    }
  | { kind: "text"; text: string; reason: Reason; direction?: Direction; note?: string }
  /** 数値を出さず指示をお願いする */
  | { kind: "block"; message: string; reason: Reason }
  /** 初期値なし：ほかの病気の数値が無ければ、指示をお願いする（心不全の食塩など） */
  | { kind: "prompt"; message: string; reason: Reason }
  /** 身長・体重などが足りない */
  | { kind: "missing"; message: string };

type Ctx = {
  age: number;
  sex: Sex | null;
  bandIndex: number;
  weight: number | null;
  sw: number | null; // 標準体重
  bmi: number | null;
  activity: Activity;
  c: Conditions;
};

const MISSING_HEIGHT = "身長を入れると計算します";
const MISSING_WEIGHT = "体重を入れると計算します";

export const CKD_LABEL: Record<CkdStage, string> = {
  G1: "G1",
  G2: "G2",
  G3a: "G3a",
  G3b: "G3b",
  G4: "G4",
  G5: "G5",
  HD: "血液透析",
  PD: "腹膜透析",
  unknown: "ステージ不明",
};

function ckdLabel(stage: CkdStage) {
  return `腎臓病（${CKD_LABEL[stage]}）`;
}

const CKD_UNKNOWN_MSG = "腎臓病のステージ（G1〜G5、透析）を主治医に確かめて、入れてください";

function r1(n: number) {
  return Math.round(n * 10) / 10;
}
function round10(n: number) {
  return Math.round(n / 10) * 10;
}
function fmt(n: number) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// 栄養素ごとのきまり

function energyRules(x: Ctx): Rule[] {
  const rules: Rule[] = [];
  const { c } = x;

  if (c.diabetes) {
    rules.push({
      kind: "block",
      message: "糖尿病のカロリーは、病院の指示を入力してください",
      reason: { label: "糖尿病", detail: "初期値は出しません（2026-11-26 決定）", source: "jds2024" },
    });
  }

  if (c.ckd) {
    const label = ckdLabel(c.ckd);
    if (c.ckd === "unknown") {
      rules.push({ kind: "block", message: CKD_UNKNOWN_MSG, reason: { label, detail: "" } });
    } else if (x.sw === null) {
      rules.push({ kind: "missing", message: MISSING_HEIGHT });
    } else {
      const dialysis = c.ckd === "HD" || c.ckd === "PD";
      const [lo, hi] = dialysis ? [30, 35] : [25, 35];
      rules.push({
        kind: "num",
        min: round10(lo * x.sw),
        max: round10(hi * x.sw),
        text: `${lo}〜${hi}kcal × 標準体重`,
        reason: { label, detail: `標準体重1kgあたり ${lo}〜${hi}kcal`, source: "jsn2014" },
        note: c.ckd === "PD" ? "腹膜から吸収されるブドウ糖の分を差し引きます（病院の指示に従ってください）" : undefined,
      });
    }
  }

  if (c.cirrhosis) {
    rules.push({
      kind: "block",
      message: "肝硬変のカロリーは、病院の指示を入力してください",
      reason: { label: "肝硬変", detail: "医師向けの最新ガイドラインが読めないため、初期値は出しません" },
    });
  }

  if (c.diet) {
    const blocked =
      x.age < 18 || x.age >= 65 || c.ckd || c.cirrhosis || c.heartFailure || c.cancer;
    if (!blocked) {
      if (x.bmi === null || x.sw === null) {
        rules.push({ kind: "missing", message: "身長と体重を入れると計算します" });
      } else if (x.bmi >= 35) {
        rules.push({
          kind: "num",
          min: round10(20 * x.sw),
          max: round10(25 * x.sw),
          text: "20〜25kcal × 目標体重 以下",
          reason: {
            label: "ダイエット（BMI 35以上）",
            detail: "目標体重1kgあたり 20〜25kcal 以下（目標体重は標準体重で計算）",
            source: "jasso2022",
          },
        });
      } else if (x.bmi >= 25) {
        rules.push({
          kind: "num",
          max: round10(25 * x.sw),
          text: "25kcal × 目標体重 以下",
          reason: {
            label: "ダイエット（BMI 25以上35未満）",
            detail: "目標体重1kgあたり 25kcal 以下（目標体重は標準体重で計算）",
            source: "jasso2022",
          },
        });
      }
    }
  }

  return rules;
}

function baseEnergy(x: Ctx): Rule {
  if (x.sex === null) return { kind: "missing", message: "性別を入れると計算します" };
  if (x.weight === null) return { kind: "missing", message: MISSING_WEIGHT };
  const row = EER_PER_KG[x.sex][x.bandIndex];
  const idx = x.activity === "low" ? 0 : x.activity === "high" ? 2 : 1;
  let perKg = row[idx];
  let note: string | undefined;
  if (perKg === null) {
    perKg = row[1];
    note = "この年齢では、活動量「ふつう」の値で計算しています";
  }
  return {
    kind: "num",
    min: round10(perKg * x.weight),
    max: round10(perKg * x.weight),
    text: `体重1kgあたり ${perKg}kcal`,
    reason: {
      label: "国の目安（病気なし）",
      detail: `推定エネルギー必要量：体重1kgあたり ${perKg}kcal × 今の体重`,
      source: "dri2025",
    },
    note,
  };
}

function proteinRules(x: Ctx): Rule[] {
  const rules: Rule[] = [];
  const { c } = x;

  if (c.ckd) {
    const label = ckdLabel(c.ckd);
    const s = c.ckd;
    if (s === "unknown") {
      rules.push({ kind: "block", message: CKD_UNKNOWN_MSG, reason: { label, detail: "" } });
    } else if (s === "G1" || s === "G2") {
      rules.push({
        kind: "text",
        text: "とりすぎないようにする",
        direction: "limit",
        reason: { label, detail: "過剰な摂取をしない", source: "jsn2014" },
      });
    } else if (x.sw === null) {
      rules.push({ kind: "missing", message: MISSING_HEIGHT });
    } else {
      const [lo, hi] =
        s === "G3a" ? [0.8, 1.0] : s === "HD" || s === "PD" ? [0.9, 1.2] : [0.6, 0.8];
      rules.push({
        kind: "num",
        min: Math.round(lo * x.sw),
        max: Math.round(hi * x.sw),
        text: `標準体重1kgあたり ${lo}〜${hi}g`,
        direction: "limit",
        reason: { label, detail: `標準体重1kgあたり ${lo}〜${hi}g`, source: "jsn2014" },
      });
    }
  }

  if (c.heartFailure) {
    const label = "心不全";
    if (x.weight === null) {
      rules.push({ kind: "missing", message: MISSING_WEIGHT });
    } else if (x.age >= 65) {
      rules.push({
        kind: "num",
        min: Math.round(1.2 * x.weight),
        max: Math.round(1.5 * x.weight),
        text: "体重1kgあたり 1.2〜1.5g",
        direction: "secure",
        reason: {
          label,
          detail: "高齢の方：体重1kgあたり 1.2〜1.5g（不足しないように）",
          source: "jcs2025",
        },
      });
    } else {
      rules.push({
        kind: "num",
        min: Math.round(1.1 * x.weight),
        text: "体重1kgあたり 1.1g以上",
        direction: "secure",
        reason: { label, detail: "体重1kgあたり 1.1g以上（不足しないように）", source: "jcs2025" },
      });
    }
  }

  if (c.cirrhosis) {
    rules.push({
      kind: "text",
      text: "極端に減らさない",
      direction: "secure",
      reason: {
        label: "肝硬変",
        detail: "昏睡のとき以外は、極端なたんぱく質制限をしない",
        source: "jsge2023",
      },
    });
  }

  return rules;
}

function saltRules(x: Ctx): Rule[] {
  const rules: Rule[] = [];
  const { c } = x;

  if (c.hypertension) {
    rules.push({
      kind: "num",
      max: 6,
      maxExclusive: true,
      text: "6g未満",
      reason: { label: "高血圧", detail: "1日6g未満", source: "jshSalt" },
    });
  }
  if (c.diabetes) {
    rules.push({
      kind: "num",
      max: 6,
      maxExclusive: true,
      text: "6g未満",
      reason: { label: "糖尿病", detail: "1日6g未満（糖尿病の方に推奨）", source: "jshSalt" },
    });
  }
  if (c.ckd) {
    const label = ckdLabel(c.ckd);
    if (c.ckd === "unknown") {
      rules.push({ kind: "block", message: CKD_UNKNOWN_MSG, reason: { label, detail: "" } });
    } else if (c.ckd === "PD") {
      rules.push({
        kind: "block",
        message: "腹膜透析の方の塩分は、除水量と尿量から決まります。病院の指示を入力してください",
        reason: { label, detail: "除水量(L)×7.5＋尿量(L)×5 g", source: "jsn2014" },
      });
    } else if (c.ckd === "HD") {
      rules.push({
        kind: "num",
        max: 6,
        maxExclusive: true,
        text: "6g未満",
        reason: { label, detail: "6g未満", source: "jsn2014" },
      });
    } else {
      rules.push({
        kind: "num",
        min: 3,
        max: 6,
        maxExclusive: true,
        text: "3g以上6g未満",
        reason: { label, detail: "3g以上6g未満（3g未満の過度な減塩は勧めない）", source: "jsn2014" },
      });
    }
  }
  if (c.heartFailure) {
    rules.push({
      kind: "prompt",
      message: "心不全の塩分は、病院の指示を入力してください",
      reason: {
        label: "心不全",
        detail: "ガイドラインは数値の目標を示していません（初期値は出しません。2026-11-26 決定）",
        source: "jcs2025",
      },
    });
  }
  if (c.cirrhosis === "yes") {
    rules.push({
      kind: "num",
      min: 5,
      max: 7,
      text: "5〜7g",
      reason: {
        label: "肝硬変（腹水あり）",
        detail: "食欲を過度に落とさない程度に 5〜7g",
        source: "jsge2023",
      },
    });
  } else if (c.cirrhosis === "unknown") {
    rules.push({
      kind: "prompt",
      message: "肝硬変の塩分は、腹水があるかどうかで変わります。主治医に確かめてください",
      reason: { label: "肝硬変（腹水 不明）", detail: "" },
    });
  } else if (c.cirrhosis === "no") {
    rules.push({
      kind: "text",
      text: "控えめに",
      reason: { label: "肝硬変（腹水なし）", detail: "塩分を控えめに", source: "jsge2023" },
    });
  }
  return rules;
}

function baseSalt(x: Ctx): Rule {
  if (x.sex === null) return { kind: "missing", message: "性別を入れると計算します" };
  const v = SALT_GOAL[x.sex][x.bandIndex];
  return {
    kind: "num",
    max: v,
    maxExclusive: true,
    text: `${fmt(v)}g未満`,
    reason: { label: "国の目安（病気なし）", detail: `食塩相当量の目標量 ${fmt(v)}g未満`, source: "dri2025" },
  };
}

function potassiumRules(x: Ctx): Rule[] {
  const { c } = x;
  if (!c.ckd) return [];
  const label = ckdLabel(c.ckd);
  switch (c.ckd) {
    case "unknown":
      return [{ kind: "block", message: CKD_UNKNOWN_MSG, reason: { label, detail: "" } }];
    case "G1":
    case "G2":
    case "G3a":
      return [{ kind: "text", text: "制限なし", reason: { label, detail: "制限なし", source: "jsn2014" } }];
    case "G3b":
    case "HD":
      return [
        { kind: "num", max: 2000, text: "2,000mg以下", reason: { label, detail: "2,000mg以下", source: "jsn2014" } },
      ];
    case "G4":
    case "G5":
      return [
        { kind: "num", max: 1500, text: "1,500mg以下", reason: { label, detail: "1,500mg以下", source: "jsn2014" } },
      ];
    case "PD":
      return [
        {
          kind: "text",
          text: "制限なし",
          reason: { label, detail: "制限なし（血液のカリウムが高いときは血液透析と同じように制限）", source: "jsn2014" },
        },
      ];
  }
}

function basePotassium(x: Ctx): Rule | null {
  // 腎臓病を選んでいる人には「多くとる」目標を出さない（向きが逆になるため）
  if (x.c.ckd) return null;
  if (x.sex === null) return { kind: "missing", message: "性別を入れると計算します" };
  const v = POTASSIUM_GOAL[x.sex][x.bandIndex];
  if (v === null) return null;
  return {
    kind: "num",
    min: v,
    text: `${fmt(v)}mg以上（多めにとる）`,
    reason: { label: "国の目安（病気なし）", detail: `カリウムの目標量 ${fmt(v)}mg以上`, source: "dri2025" },
  };
}

function waterRules(x: Ctx): Rule[] {
  const rules: Rule[] = [];
  const { c } = x;
  if (c.ckd === "unknown") {
    rules.push({ kind: "block", message: CKD_UNKNOWN_MSG, reason: { label: ckdLabel("unknown"), detail: "" } });
  } else if (c.ckd === "HD") {
    rules.push({
      kind: "prompt",
      message: "血液透析の方の水分は「できるだけ少なく」です。病院の指示を入力してください",
      reason: { label: ckdLabel("HD"), detail: "できるだけ少なく", source: "jsn2014" },
    });
  } else if (c.ckd === "PD") {
    rules.push({
      kind: "block",
      message: "腹膜透析の方の水分は、除水量と尿量から決まります。病院の指示を入力してください",
      reason: { label: ckdLabel("PD"), detail: "除水量＋尿量", source: "jsn2014" },
    });
  }
  if (c.heartFailure) {
    rules.push({
      kind: "text",
      text: "制限なし（医師の指示があれば入力）",
      reason: {
        label: "心不全",
        detail: "1日1〜1.5Lの制限は「弱く推奨」。患者ごとに判断が必要なため、初期値は制限なし",
        source: "jcs2025",
      },
    });
  }
  return rules;
}

// ---------------------------------------------------------------------------
// きまりを合わせる

function combine(
  rules: Rule[],
  base: Rule | null,
  opts: { conflictCheck?: boolean } = {}
): TargetResult {
  const missing = rules.find((r) => r.kind === "missing");
  const blocks = rules.filter((r) => r.kind === "block") as Extract<Rule, { kind: "block" }>[];
  const prompts = rules.filter((r) => r.kind === "prompt") as Extract<Rule, { kind: "prompt" }>[];
  const nums = rules.filter((r) => r.kind === "num") as Extract<Rule, { kind: "num" }>[];
  const texts = rules.filter((r) => r.kind === "text") as Extract<Rule, { kind: "text" }>[];
  const reasons: Reason[] = rules.flatMap((r) => ("reason" in r ? [r.reason] : []));

  if (blocks.length > 0) {
    return { status: "needInstruction", messages: unique(blocks.map((b) => b.message)), reasons };
  }

  if (opts.conflictCheck) {
    const dirs = new Set([...nums, ...texts].map((r) => r.direction).filter(Boolean));
    if (dirs.has("limit") && dirs.has("secure")) {
      return {
        status: "needInstruction",
        messages: [
          "腎臓病では「減らす」、心不全・肝硬変では「減らしすぎない」と、向きが逆になります。病院の指示を入力してください",
        ],
        reasons,
      };
    }
  }

  if (missing) return { status: "missing", message: (missing as { message: string }).message };

  if (nums.length > 0) {
    let min: number | undefined;
    let max: number | undefined;
    let maxExclusive = false;
    for (const n of nums) {
      if (n.min !== undefined) min = min === undefined ? n.min : Math.max(min, n.min);
      if (n.max !== undefined) {
        if (max === undefined || n.max < max || (n.max === max && n.maxExclusive)) {
          max = n.max;
          maxExclusive = !!n.maxExclusive;
        }
      }
    }
    if (min !== undefined && max !== undefined && (min > max || (min === max && maxExclusive))) {
      return {
        status: "needInstruction",
        messages: ["病気どうしの目安が食い違っています。病院の指示を入力してください"],
        reasons,
      };
    }
    const notes = [
      ...prompts.map((p) => p.message),
      ...nums.flatMap((n) => (n.note ? [n.note] : [])),
      ...texts.map((t) => `${t.reason.label}：${t.text}`),
    ];
    return {
      status: "value",
      min,
      max,
      maxExclusive,
      text: nums.length === 1 ? nums[0].text : "",
      reasons,
      notes: unique(notes),
    };
  }

  if (prompts.length > 0) {
    return { status: "needInstruction", messages: unique(prompts.map((p) => p.message)), reasons };
  }

  // 病気のきまりに数値が無い → 国の目安（病気なし）
  if (base) {
    if (base.kind === "missing") {
      if (texts.length > 0) {
        return { status: "text", text: texts.map((t) => t.text).join("・"), reasons, notes: [] };
      }
      return { status: "missing", message: base.message };
    }
    const inner = combine([base], null);
    if (inner.status === "value") {
      return {
        ...inner,
        reasons: [...reasons, ...inner.reasons],
        notes: unique([...inner.notes, ...texts.map((t) => `${t.reason.label}：${t.text}`)]),
      };
    }
  }

  if (texts.length > 0) {
    return { status: "text", text: unique(texts.map((t) => t.text)).join("・"), reasons, notes: [] };
  }
  return { status: "none" };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

// ---------------------------------------------------------------------------
// 入口

export function standardWeight(heightCm: number | null): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return r1(m * m * 22);
}

export function bmiOf(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return r1(weightKg / (m * m));
}

export function hasAnyDisease(c: Conditions): boolean {
  return c.hypertension || c.diabetes || c.heartFailure || !!c.ckd || !!c.cirrhosis || !!c.cancer;
}

export function computeTargets(input: TargetInput): TargetsOutput {
  const sw = standardWeight(input.heightCm);
  const bmi = bmiOf(input.heightCm, input.weightKg);
  const notices: string[] = [];

  const empty = (r: TargetResult) =>
    Object.fromEntries(NUTRIENTS.map((n) => [n, r])) as Record<Nutrient, TargetResult>;

  if (input.age === null || !Number.isFinite(input.age)) {
    return { bmi, standardWeight: sw, results: empty({ status: "missing", message: "年齢を入れると計算します" }), notices };
  }
  const bandIndex = ageBandIndex(input.age);
  if (bandIndex < 0) {
    return {
      bmi,
      standardWeight: sw,
      results: empty({ status: "missing", message: "1歳以上の方の目安を出します" }),
      notices,
    };
  }

  const c = input.conditions;
  const x: Ctx = {
    age: input.age,
    sex: input.sex,
    bandIndex,
    weight: input.weightKg && input.weightKg > 0 ? input.weightKg : null,
    sw,
    bmi,
    activity: input.activity,
    c,
  };

  // お子さんの病気の目安は出さない（大人向けの基準のため）
  const childWithDisease = input.age < 18 && hasAnyDisease(c);
  if (childWithDisease) {
    notices.push("病気ごとの目安は大人向けの基準です。お子さんの分は、主治医の指示を入力してください");
  }

  // ダイエットのお知らせ
  if (c.diet) {
    if (input.age < 18) {
      notices.push("18歳未満の方には、減量のためのカロリー計算をしません");
    } else if (input.age >= 65 || c.ckd || c.cirrhosis || c.heartFailure || c.cancer) {
      notices.push(
        "65歳以上の方や、腎臓病・肝硬変・心不全・がん治療中の方には、減量のためのカロリー計算をしません（筋肉が落ちる心配があるため）。主治医にご相談ください"
      );
    } else if (bmi !== null && bmi < 25) {
      notices.push("BMIが25未満のため、減量のためのカロリー計算はしません。体重を減らす必要は少ないかもしれません。主治医にご相談ください");
    }
  }
  if (c.ckd === "unknown") notices.push(CKD_UNKNOWN_MSG);
  if (c.cancer?.avoidRaw) notices.push("生ものを使う料理は、献立の提案から外します");

  const childBlock = (rules: Rule[]): Rule[] =>
    childWithDisease && rules.length > 0
      ? [
          {
            kind: "block",
            message: "お子さんの病気の目安は、主治医の指示を入力してください",
            reason: { label: "18歳未満", detail: "病気ごとの基準は大人向け" },
          },
        ]
      : rules;

  const energy = childBlock(energyRules(x));
  const protein = childBlock(proteinRules(x));
  const salt = childBlock(saltRules(x));
  const potassium = childBlock(potassiumRules(x));
  const water = childBlock(waterRules(x));

  const results: Record<Nutrient, TargetResult> = {
    energy: combine(energy, baseEnergy(x)),
    protein: combine(protein, null, { conflictCheck: true }),
    salt: combine(salt, baseSalt(x)),
    potassium: combine(potassium, basePotassium(x)),
    phosphorus: { status: "none" },
    water: combine(water, null),
  };

  // リン（透析の方）：たんぱく質(g) × 15 mg 以下
  const instr = input.instructions;
  if (childWithDisease && c.ckd) {
    results.phosphorus = {
      status: "needInstruction",
      messages: ["お子さんの病気の目安は、主治医の指示を入力してください"],
      reasons: [],
    };
  } else if (c.ckd === "unknown") {
    results.phosphorus = { status: "needInstruction", messages: [CKD_UNKNOWN_MSG], reasons: [] };
  } else if (c.ckd === "HD" || c.ckd === "PD") {
    const reason: Reason = { label: ckdLabel(c.ckd), detail: "たんぱく質(g) × 15mg 以下", source: "jsn2014" };
    const p = instr.protein ? instr.protein.value : results.protein.status === "value" ? results.protein.max : undefined;
    if (p === undefined) {
      results.phosphorus = {
        status: "needInstruction",
        messages: ["リンは、たんぱく質の量から決まります。たんぱく質かリンの指示を入力してください"],
        reasons: [reason],
      };
    } else {
      results.phosphorus = {
        status: "value",
        max: round10(p * 15),
        text: "たんぱく質(g) × 15mg 以下",
        reasons: [reason],
        notes: [],
      };
    }
  } else if (c.ckd) {
    results.phosphorus = {
      status: "text",
      text: "数値の目安なし（たんぱく質の量と血液検査で判断）",
      reasons: [{ label: ckdLabel(c.ckd), detail: "たんぱく質の指導と関連して考える", source: "jsn2014" }],
      notes: [],
    };
  }

  // 病院の指示があれば、それがいちばん優先
  for (const n of NUTRIENTS) {
    const ins = instr[n];
    if (ins && Number.isFinite(ins.value) && ins.value > 0) {
      const prev = results[n];
      results[n] = {
        status: "instruction",
        value: ins.value,
        compare: ins.compare,
        reasons: "reasons" in prev ? prev.reasons : [],
      };
    }
  }

  return { bmi, standardWeight: sw, results, notices: unique(notices) };
}

/** 画面に出す文字（例：「6g未満」「1,500〜2,100kcal」） */
export function formatTarget(n: Nutrient, r: TargetResult): string {
  const unit = NUTRIENT_INFO[n].unit;
  switch (r.status) {
    case "instruction":
      return `${fmt(r.value)}${unit}${r.compare === "about" ? "くらい" : COMPARE_LABEL[r.compare]}`;
    case "value": {
      if (r.min !== undefined && r.max !== undefined) {
        if (r.min === r.max) return `${fmt(r.min)}${unit}くらい`;
        return r.maxExclusive
          ? `${fmt(r.min)}${unit}以上 ${fmt(r.max)}${unit}未満`
          : `${fmt(r.min)}〜${fmt(r.max)}${unit}`;
      }
      if (r.max !== undefined) return `${fmt(r.max)}${unit}${r.maxExclusive ? "未満" : "以下"}`;
      if (r.min !== undefined) return `${fmt(r.min)}${unit}以上`;
      return r.text;
    }
    case "text":
      return r.text;
    case "needInstruction":
      return "病院の指示を入力してください";
    case "missing":
      return r.message;
    case "none":
      return "目安なし";
  }
}
