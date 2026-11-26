// バックアップ：スマホの中のデータを、まるごと1つのファイル（JSON）に書き出す・読み込む
import { db, type Person, type Setting, type ShoppingItem, type StockItem } from "./db";

const APP = "syokuzi";
const FORMAT = 1;

type BackupFile = {
  app: typeof APP;
  format: number;
  exportedAt: string;
  settings: Setting[];
  people: Person[];
  /** ステップ3から。古いファイルには無い */
  stock?: StockItem[];
  /** ステップ5から。古いファイルには無い */
  shopping?: ShoppingItem[];
};

export const LAST_BACKUP_KEY = "lastBackupAt";

export async function exportBackup(): Promise<{ json: string; fileName: string }> {
  const now = new Date();
  await db.settings.put({ key: LAST_BACKUP_KEY, value: now.toISOString() });
  const data: BackupFile = {
    app: APP,
    format: FORMAT,
    exportedAt: now.toISOString(),
    settings: await db.settings.toArray(),
    people: await db.people.toArray(),
    stock: await db.stock.toArray(),
    shopping: await db.shopping.toArray(),
  };
  // 日付は日本時間で
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  return { json: JSON.stringify(data, null, 2), fileName: `syokuzi-backup-${ymd}.json` };
}

/** ファイルの中身を確かめる。おかしければ理由を投げる */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("ファイルを読めませんでした（このアプリのバックアップではないようです）");
  }
  const d = data as Partial<BackupFile>;
  if (!d || d.app !== APP) throw new Error("このアプリのバックアップファイルではありません");
  if (typeof d.format !== "number" || d.format > FORMAT) {
    throw new Error("新しい版のアプリで作られたファイルです。アプリを新しくしてから読み込んでください");
  }
  if (!Array.isArray(d.settings) || !Array.isArray(d.people)) {
    throw new Error("ファイルの中身が足りません");
  }
  for (const s of d.settings) {
    if (!s || typeof s.key !== "string") throw new Error("設定の中身がおかしいところがあります");
  }
  for (const p of d.people) {
    if (!p || typeof p.id !== "number" || typeof p.nickname !== "string" || typeof p.conditions !== "object") {
      throw new Error("家族の登録の中身がおかしいところがあります");
    }
  }
  if (d.stock !== undefined) {
    if (!Array.isArray(d.stock)) throw new Error("在庫の中身がおかしいところがあります");
    for (const it of d.stock) {
      if (!it || typeof it.id !== "number" || !["冷蔵", "冷凍", "常温"].includes(it.storage)) {
        throw new Error("在庫の中身がおかしいところがあります");
      }
    }
  }
  if (d.shopping !== undefined) {
    if (!Array.isArray(d.shopping)) throw new Error("買い物リストの中身がおかしいところがあります");
    for (const it of d.shopping) {
      if (!it || typeof it.id !== "number" || typeof it.checked !== "boolean") {
        throw new Error("買い物リストの中身がおかしいところがあります");
      }
    }
  }
  return d as BackupFile;
}

/** 今のデータを消して、ファイルの中身に置きかえる */
export async function importBackup(file: BackupFile): Promise<void> {
  await db.transaction("rw", [db.settings, db.people, db.stock, db.shopping], async () => {
    await db.settings.clear();
    await db.people.clear();
    await db.stock.clear();
    await db.shopping.clear();
    await db.settings.bulkPut(file.settings);
    await db.people.bulkPut(file.people);
    await db.stock.bulkPut(file.stock ?? []);
    await db.shopping.bulkPut(file.shopping ?? []);
  });
}
