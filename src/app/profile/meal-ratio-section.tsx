"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { DEFAULT_MEAL_RATIO, MEALS, MEAL_LABEL, isValidRatio, type MealRatio } from "@/lib/plan";
import { getMealRatio, setMealRatio } from "@/lib/plan-store";

/** 1日の目安を、朝・昼・夕にどう分けるか（家族みんな共通） */
export function MealRatioSection() {
  const saved = useLiveQuery(getMealRatio);
  if (saved === undefined) return <div className="h-20" aria-busy="true" />;
  return <RatioForm key={JSON.stringify(saved)} saved={saved} />;
}

function RatioForm({ saved }: { saved: MealRatio }) {
  const [raw, setRaw] = useState<Record<string, string>>(
    Object.fromEntries(MEALS.map((m) => [m, String(saved[m])]))
  );
  const r = Object.fromEntries(MEALS.map((m) => [m, Number(raw[m])])) as MealRatio;
  const sum = MEALS.reduce((s, m) => s + (Number.isFinite(r[m]) ? r[m] : 0), 0);
  const valid = isValidRatio(r);

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
      <h2 className="text-lg font-bold">朝・昼・夕の配分</h2>
      <p className="text-sm leading-relaxed text-ink-soft">
        1日の目安（塩分・カロリーなど）を、朝・昼・夕にどう分けるかです。献立で料理を選ぶと、この配分で目安と比べます。
      </p>
      <div className="grid grid-cols-3 gap-2">
        {MEALS.map((m) => (
          <label key={m} className="space-y-1">
            <span className="block text-center font-bold">{MEAL_LABEL[m]}</span>
            <span className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${MEAL_LABEL[m]}の配分`}
                value={raw[m]}
                onChange={(e) => {
                  const v = e.target.value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
                  const next = { ...raw, [m]: v };
                  setRaw(next);
                  const nr = Object.fromEntries(MEALS.map((k) => [k, Number(next[k])])) as MealRatio;
                  if (isValidRatio(nr)) setMealRatio(nr);
                }}
                className="input w-full text-right"
              />
              %
            </span>
          </label>
        ))}
      </div>
      <p className={`font-bold ${valid ? "text-brand" : "text-danger"}`} role="status">
        合計 {sum}%{valid ? "（保存しました）" : "：合計が100%になるようにしてください"}
      </p>
      <button
        type="button"
        className="text-sm font-bold text-ink-soft underline"
        onClick={() => {
          setRaw(Object.fromEntries(MEALS.map((m) => [m, String(DEFAULT_MEAL_RATIO[m])])));
          setMealRatio(DEFAULT_MEAL_RATIO);
        }}
      >
        はじめの配分（朝{DEFAULT_MEAL_RATIO.breakfast}・昼{DEFAULT_MEAL_RATIO.lunch}・夕{DEFAULT_MEAL_RATIO.dinner}%）にもどす
      </button>
    </section>
  );
}
