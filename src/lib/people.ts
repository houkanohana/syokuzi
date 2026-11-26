// 食べる人（家族）の読み書きと、画面に出す言葉
import { db, getSetting, setSetting, type Person } from "./db";
import { CKD_LABEL, NO_CONDITIONS, type CancerSymptom, type Conditions } from "./targets";

export const CANCER_SYMPTOM_LABEL: Record<CancerSymptom, string> = {
  appetite: "食欲がない",
  nausea: "吐き気",
  stomatitis: "口内炎",
  taste: "味覚の変化",
  diarrhea: "下痢",
};

export async function addPerson(): Promise<number> {
  const now = new Date().toISOString();
  const count = await db.people.count();
  const id = await db.people.add({
    nickname: `${count + 1}人目`,
    age: null,
    sex: null,
    heightCm: null,
    weightKg: null,
    activity: "normal",
    conditions: { ...NO_CONDITIONS },
    instructions: {},
    createdAt: now,
    updatedAt: now,
  } as Person);
  return id as number;
}

export async function savePerson(p: Person): Promise<void> {
  await db.people.put({ ...p, updatedAt: new Date().toISOString() });
}

/** 病気・症状を短い言葉の一覧にする（一覧の画面用） */
export function conditionLabels(c: Conditions): string[] {
  const out: string[] = [];
  if (c.hypertension) out.push("高血圧");
  if (c.diabetes) out.push("糖尿病");
  if (c.heartFailure) out.push("心不全");
  if (c.ckd) out.push(`腎臓病（${CKD_LABEL[c.ckd]}）`);
  if (c.cirrhosis) {
    out.push(
      `肝硬変（腹水${c.cirrhosis === "yes" ? "あり" : c.cirrhosis === "no" ? "なし" : "不明"}）`
    );
  }
  if (c.cancer) out.push("抗がん剤などの副作用");
  if (c.diet) out.push("ダイエット");
  return out;
}

/** 登録していない人（お客さんなど）の人数 */
const EXTRA_KEY = "extraEaters";

export async function getExtraEaters(): Promise<number> {
  return (await getSetting<number>(EXTRA_KEY)) ?? 0;
}

export async function setExtraEaters(n: number): Promise<void> {
  await setSetting(EXTRA_KEY, Math.max(0, Math.min(20, Math.round(n))));
}
