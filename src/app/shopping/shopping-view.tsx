"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useState } from "react";
import { RECIPES } from "@/data/recipes";
import { db } from "@/lib/db";
import { searchFoods } from "@/lib/foods";
import { PANTRY_CATEGORIES } from "@/lib/plan";
import { addCustomShopping, moveCheckedToStock, shoppingName } from "@/lib/plan-store";

function grams(n: number) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

export function ShoppingView() {
  const items = useLiveQuery(() => db.shopping.toArray());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // 押したらすぐ表示を変える（保存を待つと、チェックが一瞬もどって見えるため）
  const [local, setLocal] = useState<Record<number, boolean>>({});

  if (items === undefined) return <div className="h-40" aria-busy="true" />;

  const isChecked = (it: { id: number; checked: boolean }) => local[it.id] ?? it.checked;
  const sorted = [...items].sort((a, b) => a.id - b.id);
  const checked = items.filter(isChecked).length;
  const results = query.trim() ? searchFoods(query, 8) : [];

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="rounded-xl bg-white p-4 leading-relaxed text-ink-soft ring-1 ring-line">
          買い物リストは空です。「
          <Link href="/" className="font-bold text-brand underline">
            献立
          </Link>
          」で料理を選び、「足りない食材を買い物リストに入れる」を押すと、ここに並びます。
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl bg-white ring-1 ring-line">
          {sorted.map((it) => (
            <li key={it.id}>
              <label className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={isChecked(it)}
                  onChange={(e) => {
                    setLocal({ ...local, [it.id]: e.target.checked });
                    db.shopping.update(it.id, { checked: e.target.checked });
                  }}
                  className="mt-0.5 size-6 shrink-0 accent-brand"
                  aria-label={`${shoppingName(it)}を買った`}
                />
                <span className={`flex-1 ${isChecked(it) ? "text-ink-soft line-through" : ""}`}>
                  <span className="block text-lg font-bold">{shoppingName(it)}</span>
                  {it.recipeIds.length > 0 && (
                    <span className="block text-sm text-ink-soft">
                      {it.recipeIds.map((id) => RECIPES.find((r) => r.id === id)?.name ?? id).join("・")}
                    </span>
                  )}
                </span>
                {it.grams !== null && <span className="shrink-0 font-bold">約{grams(it.grams)}g</span>}
              </label>
            </li>
          ))}
        </ul>
      )}

      {checked > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-xl bg-brand py-3 font-bold text-white"
            onClick={async () => {
              const n = await moveCheckedToStock(PANTRY_CATEGORIES);
              setMessage(`${n}品を在庫（調味料は「家にある調味料」）に入れました`);
            }}
          >
            買ったもの（{checked}品）を在庫に入れる
          </button>
          <button
            type="button"
            className="w-full rounded-xl py-2 font-bold text-ink-soft ring-1 ring-line"
            onClick={async () => {
              await db.shopping.bulkDelete(items.filter(isChecked).map((i) => i.id));
              setMessage(null);
            }}
          >
            チェックしたものをリストから消すだけ
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="font-bold text-brand">
          ✓ {message}
        </p>
      )}

      <section className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-bold">自分で足す</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="食材の名前（例：ぎゅうにゅう）"
          aria-label="買い物リストに足す食材"
          className="input w-full"
        />
        {query.trim() && (
          <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="w-full px-3 py-3 text-left font-bold"
                  onClick={async () => {
                    await addCustomShopping(f.id, null);
                    setQuery("");
                  }}
                >
                  ＋ {f.name}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="w-full px-3 py-3 text-left text-ink-soft"
                onClick={async () => {
                  await addCustomShopping(null, query.trim());
                  setQuery("");
                }}
              >
                ＋「{query.trim()}」をそのまま足す
              </button>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
