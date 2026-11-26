"use client";

import { useState } from "react";
import { DISCLAIMER_ITEMS } from "@/lib/disclaimer";

/** 免責の文面。onAgree を渡すと、同意のチェックと「はじめる」ボタンが出る */
export function DisclaimerView({ onAgree }: { onAgree?: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {DISCLAIMER_ITEMS.map((item, i) => (
          <li key={item.title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
            <p className="font-bold">
              {i + 1}. {item.title}
            </p>
            <p className="mt-1 leading-relaxed text-ink-soft">{item.body}</p>
          </li>
        ))}
      </ol>

      {onAgree && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-6 shrink-0 accent-brand"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span className="font-bold">上の内容を読み、同意します</span>
          </label>
          <button
            type="button"
            disabled={!checked || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAgree();
              } finally {
                setBusy(false);
              }
            }}
            className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white disabled:bg-line disabled:text-ink-soft"
          >
            はじめる
          </button>
        </div>
      )}
    </div>
  );
}
