// 目安値の計算に使う「表の数値」。すべて出典の原文で確かめたもの（docs/目安値の案.md）。
// 数値を変えるときは、必ず出典を確かめ、docs/目安値の案.md も同じように直す。

export type Sex = "male" | "female";
export type Activity = "low" | "normal" | "high";

export type SourceId =
  | "dri2025"
  | "jsn2014"
  | "jshSalt"
  | "jcs2025"
  | "jsge2023"
  | "jasso2022"
  | "jds2024";

export const SOURCES: Record<SourceId, { title: string; url: string }> = {
  dri2025: {
    title: "厚生労働省「日本人の食事摂取基準（2025年版）」",
    url: "https://www.mhlw.go.jp/stf/newpage_44138.html",
  },
  jsn2014: {
    title: "日本腎臓学会「慢性腎臓病に対する食事療法基準2014年版」",
    url: "https://jsn.or.jp/journal/document/56_5/553-599.pdf",
  },
  jshSalt: {
    title: "日本高血圧学会「ナトリウム（食塩）の減らし方」",
    url: "https://www.jpnsh.jp/data/salt01.pdf",
  },
  jcs2025: {
    title: "日本循環器学会・日本心不全学会「2025年改訂版 心不全診療ガイドライン」",
    url: "https://www.j-circ.or.jp/cms/wp-content/uploads/2025/03/JCS2025_Kato.pdf",
  },
  jsge2023: {
    title: "日本消化器病学会「患者さんとご家族のための肝硬変ガイド2023」",
    url: "https://www.jsge.or.jp/committees/guideline/disease/pdf/kankouhen_2023.pdf",
  },
  jasso2022: {
    title: "日本肥満学会「肥満症診療ガイドライン2022」",
    url: "https://www.jasso.or.jp/contents/magazine/journal.html",
  },
  jds2024: {
    title: "日本糖尿病学会「糖尿病診療ガイドライン2024」",
    url: "https://www.jds.or.jp/modules/publication/index.php?content_id=4",
  },
};

/** 年齢の区分（食事摂取基準の区分） */
type AgeBand = { from: number; to: number }; // to は含む

const BANDS: AgeBand[] = [
  { from: 1, to: 2 },
  { from: 3, to: 5 },
  { from: 6, to: 7 },
  { from: 8, to: 9 },
  { from: 10, to: 11 },
  { from: 12, to: 14 },
  { from: 15, to: 17 },
  { from: 18, to: 29 },
  { from: 30, to: 49 },
  { from: 50, to: 64 },
  { from: 65, to: 74 },
  { from: 75, to: 200 },
];

export function ageBandIndex(age: number): number {
  return BANDS.findIndex((b) => age >= b.from && age <= b.to);
}

/**
 * 体重1kgあたりの推定エネルギー必要量（kcal/kg/日）
 * 出典：食事摂取基準2025 エネルギーの章 参考表1。null は表にない（その活動レベルは使わない）。
 * 並び：[低い, ふつう, 高い]
 */
export const EER_PER_KG: Record<Sex, ([number | null, number, number | null])[]> = {
  male: [
    [null, 82.4, null], // 1〜2
    [null, 79.5, null], // 3〜5
    [59.8, 68.7, 77.5], // 6〜7
    [57.1, 65.3, 73.4], // 8〜9
    [54.2, 61.7, 69.2], // 10〜11
    [46.5, 52.7, 58.9], // 12〜14
    [41.9, 47.3, 52.7], // 15〜17
    [35.6, 41.5, 47.4], // 18〜29
    [33.8, 39.4, 45.0], // 30〜49
    [32.7, 38.2, 43.6], // 50〜64
    [32.4, 36.7, 41.0], // 65〜74
    [30.1, 36.6, null], // 75以上
  ],
  female: [
    [null, 80.6, null],
    [null, 75.7, null],
    [56.6, 64.9, 73.3],
    [53.6, 61.3, 68.9],
    [50.5, 57.4, 64.4],
    [44.4, 50.3, 56.2],
    [39.2, 44.3, 49.3],
    [33.2, 38.7, 44.2],
    [32.9, 38.3, 43.8],
    [31.1, 36.2, 41.4],
    [31.1, 35.2, 39.3],
    [29.0, 35.2, null],
  ],
};

/**
 * 食塩相当量の目標量（g/日・未満）
 * 出典：食事摂取基準2025 ナトリウム 表1 の(D)
 */
export const SALT_GOAL: Record<Sex, number[]> = {
  male: [3.0, 3.5, 4.5, 5.0, 6.0, 7.0, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
  female: [2.5, 3.5, 4.5, 5.0, 6.0, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
};

/**
 * カリウムの目標量（mg/日・以上）。1〜2歳は目標量なし（null）
 * 出典：食事摂取基準2025 カリウム 表2 の(D)
 */
export const POTASSIUM_GOAL: Record<Sex, (number | null)[]> = {
  male: [null, 1600, 1800, 2000, 2200, 2600, 3000, 3000, 3000, 3000, 3000, 3000],
  female: [null, 1400, 1600, 1800, 2000, 2400, 2600, 2600, 2600, 2600, 2600, 2600],
};
