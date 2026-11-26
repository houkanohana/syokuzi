// スマホの中の保存場所（ブラウザの IndexedDB という保存領域）。
// 第1段階はサーバーを使わず、入力したものはすべてここに置く。外には送らない。
//
// 表（テーブル）を足すときは、version(1) を消さずに version(2) を足していく
// （すでに使っている人のデータを壊さないため）。
import Dexie, { type EntityTable } from "dexie";
import type { Activity, Conditions, Instruction, Nutrient, Sex } from "./targets";

/** 設定の1件（キーと値の組） */
export type Setting = { key: string; value: unknown };

/** 食べる人（家族の1人） */
export type Person = {
  id: number;
  /** 呼び名（例：父、本人）。このスマホの中だけに保存 */
  nickname: string;
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: Activity;
  conditions: Conditions;
  /** 病院の指示（入れた栄養素だけ） */
  instructions: Partial<Record<Nutrient, Instruction>>;
  createdAt: string;
  updatedAt: string;
};

/** 家にある食材（在庫）の1件 */
export type StockItem = {
  id: number;
  /** 食材データの食品番号。一覧にない食材を自由に入れたときは null */
  foodId: string | null;
  /** 一覧にない食材の名前（foodId が null のとき） */
  customName: string | null;
  storage: "冷蔵" | "冷凍" | "常温";
  /** 量（入れなくてもよい） */
  amount: number | null;
  unit: string | null;
  /** 期限（YYYY-MM-DD、入れなくてもよい） */
  expiry: string | null;
  createdAt: string;
  updatedAt: string;
};

class AppDB extends Dexie {
  settings!: EntityTable<Setting, "key">;
  people!: EntityTable<Person, "id">;
  stock!: EntityTable<StockItem, "id">;

  constructor() {
    super("syokuzi");
    this.version(1).stores({ settings: "key" });
    // ステップ2：食べる人（家族）を足す
    this.version(2).stores({ settings: "key", people: "++id" });
    // ステップ3：在庫を足す
    this.version(3).stores({ settings: "key", people: "++id", stock: "++id, foodId, storage" });
  }
}

export const db = new AppDB();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/**
 * 「このデータは消さないで」とブラウザに頼む。
 * 認められると、容量が足りなくなってもブラウザが勝手に消しにくくなる。
 * 認められたかどうかを返す（対応していないブラウザでは false）。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
