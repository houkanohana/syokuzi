"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { getPantry } from "@/lib/plan-store";
import { db, type StockItem } from "@/lib/db";
import { CATEGORIES, FOODS, FOOD_SOURCE, STORAGES, searchFoods, type Food, type Storage } from "@/lib/foods";
import {
  UNITS,
  addDays,
  addStock,
  expiryLevel,
  expiryText,
  removeStock,
  sortStock,
  stockName,
  todayTokyo,
  updateStock,
} from "@/lib/stock";

type Filter = "all" | Storage;

const STORAGE_ICON: Record<Storage, string> = { 冷蔵: "🧊", 冷凍: "❄️", 常温: "🏠" };

export function StockView() {
  const items = useLiveQuery(() => db.stock.toArray());
  const pantryCount = useLiveQuery(async () => (await getPantry()).length) ?? 0;
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  if (items === undefined) return <div className="h-40" aria-busy="true" />;

  const today = todayTokyo();
  const over = items.filter((i) => expiryLevel(i.expiry, today) === "over").length;
  const soon = items.filter((i) => expiryLevel(i.expiry, today) === "soon").length;
  const shown = filter === "all" ? STORAGES : [filter];

  return (
    <div className="space-y-4">
      {(over > 0 || soon > 0) && (
        <p className="rounded-xl bg-notice p-3 font-bold leading-relaxed ring-1 ring-notice-line" role="status">
          {over > 0 && <span className="block text-danger">⚠ 期限が過ぎたものが {over}品 あります</span>}
          {soon > 0 && <span className="block">⏰ 2日以内に期限が来るものが {soon}品 あります</span>}
        </p>
      )}

      <Link
        href="/stock/pantry/"
        className="flex items-center justify-between rounded-xl bg-white p-4 font-bold shadow-sm ring-1 ring-line"
      >
        <span>
          🧂 家にある調味料・油・粉
          <span className="block text-sm font-normal text-ink-soft">
            {pantryCount === 0 ? "まだ登録がありません" : `${pantryCount}品を登録しています`}
          </span>
        </span>
        <span className="text-brand">登録する ›</span>
      </Link>

      {adding ? (
        <AddPanel onClose={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white"
        >
          ＋ 食材を追加
        </button>
      )}

      {/* 保存場所で絞る */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="tablist">
        {(["all", ...STORAGES] as Filter[]).map((f) => {
          const n = f === "all" ? items.length : items.filter((i) => i.storage === f).length;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-lg py-2 text-sm font-bold ${filter === f ? "bg-brand text-white" : "text-ink-soft"}`}
            >
              {f === "all" ? "すべて" : f}
              <span className="block text-xs font-normal">{n}品</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="rounded-xl bg-white p-4 leading-relaxed text-ink-soft ring-1 ring-line">
          まだ登録がありません。「食材を追加」から、家にある食材を入れてください。量や期限は入れなくても大丈夫です。
        </p>
      )}

      {shown.map((st) => {
        const list = sortStock(items.filter((i) => i.storage === st));
        if (list.length === 0) return null;
        return (
          <section key={st} className="space-y-2">
            <h2 className="text-lg font-bold">
              {STORAGE_ICON[st]} {st}（{list.length}品）
            </h2>
            <ul className="space-y-2">
              {list.map((it) => (
                <StockRow
                  key={it.id}
                  item={it}
                  today={today}
                  open={openId === it.id}
                  onToggle={() => setOpenId(openId === it.id ? null : it.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-xs leading-relaxed text-ink-soft [overflow-wrap:anywhere]">食材の栄養の数値：{FOOD_SOURCE}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 在庫の1行（押すと、量・期限・保存場所を直せる）

function StockRow({
  item,
  today,
  open,
  onToggle,
}: {
  item: StockItem;
  today: string;
  open: boolean;
  onToggle: () => void;
}) {
  const level = expiryLevel(item.expiry, today);
  const name = stockName(item);
  return (
    <li className={`rounded-xl bg-white ring-1 ${level === "over" ? "ring-danger" : level === "soon" ? "ring-notice-line" : "ring-line"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="flex-1">
          <span className="block text-lg font-bold">{name}</span>
          {item.expiry && (
            <span
              className={`block text-sm font-bold ${
                level === "over" ? "text-danger" : level === "soon" ? "text-ink" : "text-ink-soft"
              }`}
            >
              {level === "over" ? "⚠ " : level === "soon" ? "⏰ " : ""}
              {expiryText(item.expiry, today)}
            </span>
          )}
        </span>
        {item.amount !== null && (
          <span className="shrink-0 font-bold">
            {item.amount}
            {item.unit ?? ""}
          </span>
        )}
        <span className="shrink-0 text-ink-soft" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3">
          <StockFields
            storage={item.storage}
            amount={item.amount}
            unit={item.unit}
            expiry={item.expiry}
            onChange={(patch) => updateStock(item.id, patch)}
          />
          <button
            type="button"
            className="w-full rounded-xl border-2 border-danger py-3 font-bold text-danger"
            onClick={() => removeStock(item.id)}
          >
            使い切った（一覧から消す）
          </button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// 食材を追加する（検索・分類から選ぶ・一覧にないものを入れる）

function AddPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [picked, setPicked] = useState<Food | "custom" | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const results = query.trim() ? searchFoods(query) : category ? FOODS.filter((f) => f.category === category) : [];

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-brand">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">食材を追加</h2>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 font-bold text-ink-soft ring-1 ring-line">
          閉じる
        </button>
      </div>

      {done && (
        <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 font-bold text-brand">
          ✓ {done}を追加しました。続けて追加できます
        </p>
      )}

      {picked ? (
        <AddForm
          food={picked === "custom" ? null : picked}
          onCancel={() => setPicked(null)}
          onAdded={(name) => {
            setDone(name);
            setPicked(null);
            setQuery("");
          }}
        />
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDone(null);
            }}
            placeholder="食材の名前で探す（例：きゃべつ）"
            aria-label="食材の名前で探す"
            className="input w-full"
          />
          {!query.trim() && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">または、分類から選ぶ</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(category === c ? null : c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${
                      category === c ? "bg-brand text-white ring-brand" : "bg-white ring-line"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {results.length > 0 && (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg ring-1 ring-line">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(f)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                  >
                    <span className="font-bold">{f.name}</span>
                    <span className="shrink-0 text-sm text-ink-soft">{f.storage}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && results.length === 0 && (
            <p className="text-ink-soft">「{query}」は一覧にありませんでした。</p>
          )}
          <button
            type="button"
            onClick={() => setPicked("custom")}
            className="w-full rounded-lg py-2 font-bold text-brand underline"
          >
            一覧にない食材を入れる
          </button>
        </>
      )}
    </section>
  );
}

function AddForm({
  food,
  onCancel,
  onAdded,
}: {
  food: Food | null;
  onCancel: () => void;
  onAdded: (name: string) => void;
}) {
  const [customName, setCustomName] = useState("");
  const [fields, setFields] = useState<{
    storage: Storage;
    amount: number | null;
    unit: string | null;
    expiry: string | null;
  }>({ storage: food?.storage ?? "冷蔵", amount: null, unit: null, expiry: null });
  const name = food ? food.name : customName.trim();

  return (
    <div className="space-y-3">
      {food ? (
        <p className="text-xl font-bold">{food.name}</p>
      ) : (
        <label className="block space-y-1">
          <span className="block text-sm font-bold">食材の名前</span>
          <input
            type="text"
            value={customName}
            maxLength={30}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="例：ちりめん山椒"
            className="input w-full"
          />
          <span className="block text-sm text-ink-soft">一覧にない食材は、栄養の計算には使われません。</span>
        </label>
      )}
      <StockFields {...fields} onChange={(patch) => setFields((cur) => ({ ...cur, ...patch }))} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-3 font-bold ring-1 ring-line">
          もどる
        </button>
        <button
          type="button"
          disabled={!name}
          onClick={async () => {
            await addStock({
              foodId: food?.id ?? null,
              customName: food ? null : name,
              ...fields,
            });
            onAdded(name);
          }}
          className="flex-[2] rounded-xl bg-brand py-3 text-lg font-bold text-white disabled:opacity-40"
        >
          追加する
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 保存場所・量・期限の入力（追加と編集で共通）

function StockFields({
  storage,
  amount,
  unit,
  expiry,
  onChange,
}: {
  storage: Storage;
  amount: number | null;
  unit: string | null;
  expiry: string | null;
  onChange: (patch: { storage?: Storage; amount?: number | null; unit?: string | null; expiry?: string | null }) => void;
}) {
  const [rawAmount, setRawAmount] = useState(amount === null ? "" : String(amount));
  const today = todayTokyo();
  const quick: [string, string | null][] = [
    ["明日", addDays(today, 1)],
    ["3日後", addDays(today, 3)],
    ["1週間後", addDays(today, 7)],
    ["なし", null],
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="block text-sm font-bold">保存場所</span>
        <div className="grid grid-cols-3 gap-2">
          {STORAGES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={storage === s}
              onClick={() => onChange({ storage: s })}
              className={`rounded-lg py-2 font-bold ring-2 ${
                storage === s ? "bg-brand-soft text-brand ring-brand" : "bg-white ring-line"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-bold">量（入れなくても大丈夫）</span>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            aria-label="量"
            value={rawAmount}
            placeholder="例：2"
            onChange={(e) => {
              const v = e.target.value.replace(/[０-９．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
              setRawAmount(v);
              const n = Number(v);
              if (v.trim() === "") onChange({ amount: null });
              else if (Number.isFinite(n) && n >= 0) onChange({ amount: n });
            }}
            className="input w-24 text-right"
          />
          <select
            aria-label="単位"
            value={unit ?? ""}
            onChange={(e) => onChange({ unit: e.target.value || null })}
            className="input flex-1"
          >
            <option value="">（単位なし）</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-bold">期限（入れなくても大丈夫）</span>
        <div className="grid grid-cols-4 gap-2">
          {quick.map(([label, v]) => (
            <button
              key={label}
              type="button"
              aria-pressed={expiry === v}
              onClick={() => onChange({ expiry: v })}
              className={`rounded-lg py-2 text-sm font-bold ring-1 ${
                expiry === v ? "bg-brand-soft text-brand ring-brand" : "bg-white ring-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label="期限の日付"
          value={expiry ?? ""}
          onChange={(e) => onChange({ expiry: e.target.value || null })}
          className="input w-full"
        />
      </div>
    </div>
  );
}
