"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { db } from "@/lib/db";
import { addPerson, conditionLabels, getExtraEaters, setExtraEaters } from "@/lib/people";
import { NUTRIENTS, computeTargets } from "@/lib/targets";

/** 食べる人の一覧と、何人分か */
export function PeopleSection() {
  const router = useRouter();
  const people = useLiveQuery(() => db.people.orderBy("id").toArray());
  const extra = useLiveQuery(getExtraEaters);
  const [adding, setAdding] = useState(false);

  if (people === undefined || extra === undefined) {
    return <div className="h-40" aria-busy="true" />;
  }

  const total = people.length + extra;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="text-lg font-bold">何人分つくるか</h2>
        <p className="mt-1 text-3xl font-bold text-brand">
          {total}
          <span className="ml-1 text-lg">人分</span>
        </p>
        <p className="text-ink-soft">
          下に登録した {people.length}人 ＋ 登録していない人 {extra}人
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex-1">登録していない人（お客さんなど）</span>
          <button
            type="button"
            aria-label="登録していない人を1人へらす"
            className="size-11 rounded-lg border border-line text-xl font-bold disabled:opacity-40"
            disabled={extra <= 0}
            onClick={() => setExtraEaters(extra - 1)}
          >
            −
          </button>
          <span className="w-8 text-center text-xl font-bold">{extra}</span>
          <button
            type="button"
            aria-label="登録していない人を1人ふやす"
            className="size-11 rounded-lg border border-line text-xl font-bold"
            onClick={() => setExtraEaters(extra + 1)}
          >
            ＋
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">食べる人</h2>
        {people.length === 0 && (
          <p className="rounded-xl bg-white p-4 leading-relaxed text-ink-soft ring-1 ring-line">
            まだ登録がありません。「食べる人を追加」から、体の状態を入れてください。
          </p>
        )}
        <ul className="space-y-3">
          {people.map((p) => {
            const t = computeTargets(p);
            const needs = NUTRIENTS.filter((n) => t.results[n].status === "needInstruction").length;
            const labels = conditionLabels(p.conditions);
            return (
              <li key={p.id}>
                <Link
                  href={`/profile/person/?id=${p.id}`}
                  className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-line"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold">{p.nickname || "（呼び名なし）"}</span>
                    <span className="shrink-0 text-ink-soft">
                      {p.age !== null ? `${p.age}歳` : "年齢未入力"}・
                      {p.sex === "male" ? "男性" : p.sex === "female" ? "女性" : "性別未入力"}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-soft">
                    {labels.length > 0 ? labels.join("・") : "病気・症状の登録なし"}
                  </p>
                  {needs > 0 && (
                    <p className="mt-2 rounded-lg bg-notice px-3 py-2 font-bold">
                      ⚠ 病院の指示を入れてほしい項目が {needs}つ あります
                    </p>
                  )}
                  <p className="mt-2 text-right font-bold text-brand">くわしく・なおす ›</p>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={adding}
          onClick={async () => {
            setAdding(true);
            try {
              const id = await addPerson();
              router.push(`/profile/person/?id=${id}`);
            } finally {
              setAdding(false);
            }
          }}
          className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white disabled:opacity-60"
        >
          ＋ 食べる人を追加
        </button>
      </section>
    </div>
  );
}
