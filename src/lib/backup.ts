// バックアップ：スマホの中のデータを、まるごと1つのファイル（JSON）に書き出す・読み込む
import { db, type Person, type Setting } from "./db";

const APP = "syokuzi";
const FORMAT = 1;

type BackupFile = {
  app: typeof APP;
  format: number;
  exportedAt: string;
  settings: Setting[];
  people: Person[];
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
  return d as BackupFile;
}

/** 今のデータを消して、ファイルの中身に置きかえる */
export async function importBackup(file: BackupFile): Promise<void> {
  await db.transaction("rw", db.settings, db.people, async () => {
    await db.settings.clear();
    await db.people.clear();
    await db.settings.bulkPut(file.settings);
    await db.people.bulkPut(file.people);
  });
}
