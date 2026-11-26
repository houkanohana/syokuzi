"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { FOODS } from "@/lib/foods";
import { PANTRY_CATEGORIES } from "@/lib/plan";
import { getPantry, setPantry } from "@/lib/plan-store";

export function PantryView() {
  const pantry = useLiveQuery(getPantry);
  if (pantry === undefined) return <div className="h-40" aria-busy="true" />;
  return <PantryForm initial={pantry} />;
}

// 押したらすぐ表示を変え、あとから保存する（保存を待つと、チェックが一瞬もどって見えるため）
function PantryForm({ initial }: { initial: string[] }) {
  const [have, setHave] = useState(() => new Set(initial));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(have);
    if (on) next.add(id);
    else next.delete(id);
    setHave(next);
    setPantry([...next]);
  };

  return (
    <div className="space-y-4">
      <p className="font-bold" role="status">
        いま {have.size}品 にチェックが入っています
      </p>
      {PANTRY_CATEGORIES.map((cat) => (
        <section key={cat} className="space-y-1 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="mb-1 text-lg font-bold">{cat}</h2>
          <ul className="grid grid-cols-1 gap-1">
            {FOODS.filter((f) => f.category === cat).map((f) => (
              <li key={f.id}>
                <label className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <input
                    type="checkbox"
                    checked={have.has(f.id)}
                    onChange={(e) => toggle(f.id, e.target.checked)}
                    className="size-6 shrink-0 accent-brand"
                  />
                  <span className={have.has(f.id) ? "font-bold" : ""}>{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
