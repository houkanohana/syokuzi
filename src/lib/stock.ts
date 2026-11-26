// 在庫（家にある食材）の読み書きと、期限の計算
import { db, type StockItem } from "./db";
import { foodById, type Storage } from "./foods";

export const UNITS = ["個", "本", "枚", "玉", "束", "袋", "パック", "切れ", "丁", "缶", "g", "mL"];

/** 日本時間の今日（YYYY-MM-DD） */
export function todayTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

/** 日本時間の「今日から n 日後」（YYYY-MM-DD） */
export function addDays(ymd: string, n: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 期限までの日数（今日が期限なら 0、過ぎていればマイナス） */
export function daysUntil(expiry: string, today: string = todayTokyo()): number {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export type ExpiryLevel = "over" | "soon" | "ok" | "none";

/** 期限の状態：過ぎた／2日以内／まだ先／期限なし */
export function expiryLevel(expiry: string | null, today: string = todayTokyo()): ExpiryLevel {
  if (!expiry) return "none";
  const d = daysUntil(expiry, today);
  if (d < 0) return "over";
  if (d <= 2) return "soon";
  return "ok";
}

export function expiryText(expiry: string | null, today: string = todayTokyo()): string {
  if (!expiry) return "";
  const d = daysUntil(expiry, today);
  const [, m, day] = expiry.split("-").map(Number);
  const date = `${m}/${day}`;
  if (d < 0) return `${date}（${-d}日過ぎています）`;
  if (d === 0) return `${date}（今日まで）`;
  if (d === 1) return `${date}（明日まで）`;
  if (d === 2) return `${date}（あさってまで）`;
  return `${date}まで`;
}

export function stockName(item: Pick<StockItem, "foodId" | "customName">): string {
  if (item.foodId) return foodById(item.foodId)?.name ?? "（不明な食材）";
  return item.customName ?? "（名前なし）";
}

/** 期限の近い順（期限なしは最後）、同じなら名前順 */
export function sortStock(items: StockItem[]): StockItem[] {
  return [...items].sort((a, b) => {
    if (a.expiry && b.expiry && a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
    if (a.expiry && !b.expiry) return -1;
    if (!a.expiry && b.expiry) return 1;
    return stockName(a).localeCompare(stockName(b), "ja");
  });
}

export async function addStock(input: {
  foodId: string | null;
  customName: string | null;
  storage: Storage;
  amount: number | null;
  unit: string | null;
  expiry: string | null;
}): Promise<number> {
  const now = new Date().toISOString();
  return (await db.stock.add({ ...input, createdAt: now, updatedAt: now } as StockItem)) as number;
}

export async function updateStock(id: number, patch: Partial<StockItem>): Promise<void> {
  await db.stock.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function removeStock(id: number): Promise<void> {
  await db.stock.delete(id);
}
