import { describe, expect, it } from "vitest";
import type { StockItem } from "./db";
import { addDays, daysUntil, expiryLevel, expiryText, sortStock, todayTokyo } from "./stock";

describe("期限（日本時間）", () => {
  it("日本時間で日付を出す（UTCの26日18時は、日本では27日）", () => {
    expect(todayTokyo(new Date("2026-11-26T18:00:00Z"))).toBe("2026-11-27");
    expect(todayTokyo(new Date("2026-11-26T14:59:00Z"))).toBe("2026-11-26");
  });

  it("日数の計算（月またぎ）", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(daysUntil("2026-12-02", "2026-11-29")).toBe(3);
  });

  it("期限の状態と表示", () => {
    const today = "2026-11-27";
    expect(expiryLevel("2026-11-26", today)).toBe("over");
    expect(expiryLevel("2026-11-27", today)).toBe("soon");
    expect(expiryLevel("2026-11-29", today)).toBe("soon");
    expect(expiryLevel("2026-11-30", today)).toBe("ok");
    expect(expiryLevel(null, today)).toBe("none");
    expect(expiryText("2026-11-26", today)).toBe("11/26（1日過ぎています）");
    expect(expiryText("2026-11-28", today)).toBe("11/28（明日まで）");
  });
});

describe("並べ方", () => {
  it("期限の近い順、期限なしは最後", () => {
    const base = { customName: null, storage: "冷蔵", amount: null, unit: null, createdAt: "", updatedAt: "" } as const;
    const items: StockItem[] = [
      { ...base, id: 1, foodId: "06061", expiry: null },
      { ...base, id: 2, foodId: "12004", expiry: "2026-12-05" },
      { ...base, id: 3, foodId: "13003", expiry: "2026-11-30" },
    ];
    expect(sortStock(items).map((i) => i.id)).toEqual([3, 2, 1]);
  });
});
