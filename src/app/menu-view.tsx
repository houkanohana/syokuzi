"use client";

import Link from "next/link";
import { useState } from "react";
import { MealCheckView } from "@/components/meal-check-view";
import { RECIPES } from "@/data/recipes";
import { foodById } from "@/lib/foods";
import {
  MEALS,
  MEAL_LABEL,
  anyAvoidRaw,
  checkMeal,
  servingsOf,
  suggest,
  type Suggestion,
} from "@/lib/plan";
import { addToShopping, setPlan, toggleSelected } from "@/lib/plan-store";
import { recipeNutrition, type RecipeKind } from "@/lib/recipes";
import { todayTokyo } from "@/lib/stock";
import { useHousehold } from "@/lib/use-household";

const KINDS: RecipeKind[] = ["主菜", "副菜", "汁物", "主食"];

export function MenuView() {
  const h = useHousehold();
  const [kind, setKind] = useState<RecipeKind>("主菜");
  const [softOnly, setSoftOnly] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!h) return <div className="h-40" aria-busy="true" />;

  const { people, plan, ratio } = h;
  const servings = servingsOf(people, h.extra);
  const avoidRaw = anyAvoidRaw(people);
  const mealLabel = MEAL_LABEL[plan.meal];
  const pct = ratio[plan.meal];

  const all = suggest(RECIPES, { stock: h.stock, pantry: h.pantry, avoidRaw, softOnly, today: todayTokyo() });
  const byId = new Map(all.map((s) => [s.recipe.id, s]));
  // 生ものを外したなどで出せなくなった料理は、選んだものからも外して数える
  const selected = plan.selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const list = all.filter((s) => s.recipe.kind === kind);
  const mealCheck = checkMeal(people, selected.map((s) => s.recipe), pct);
  const missingCount = selected.reduce((n, s) => n + s.missingMain.length + s.missingPantry.length, 0);

  return (
    <div className="space-y-4">
      {/* どの食事か */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="tablist" aria-label="どの食事か">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={plan.meal === m}
            onClick={() => setPlan({ ...plan, meal: m })}
            className={`rounded-lg py-2 font-bold ${plan.meal === m ? "bg-brand text-white" : "text-ink-soft"}`}
          >
            {MEAL_LABEL[m]}ごはん
            <span className="block text-xs font-normal">1日の{ratio[m]}%</span>
          </button>
        ))}
      </div>

      <p className="text-ink-soft">
        {servings}人分で考えます（
        <Link href="/profile/" className="font-bold text-brand underline">
          人数を変える
        </Link>
        ）
      </p>

      {avoidRaw && (
        <p className="rounded-xl bg-notice p-3 leading-relaxed ring-1 ring-notice-line">
          生ものを避ける方がいるため、生野菜などを使う料理は出していません。
        </p>
      )}

      {/* 選んだ料理 */}
      {selected.length > 0 && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-brand" aria-label="選んだ料理">
          <h2 className="text-lg font-bold">
            選んだ料理（{mealLabel}・{selected.length}品）
          </h2>
          <ul className="space-y-1">
            {selected.map((s) => (
              <li key={s.recipe.id} className="flex items-center justify-between gap-2">
                <Link href={`/recipe/?id=${s.recipe.id}`} className="font-bold underline">
                  {s.recipe.name}
                </Link>
                <button
                  type="button"
                  className="shrink-0 text-sm font-bold text-ink-soft underline"
                  onClick={() => toggleSelected(s.recipe.id)}
                >
                  外す
                </button>
              </li>
            ))}
          </ul>
          <h3 className="font-bold">1人分の合計を、{mealLabel}の目安（1日の{pct}%）と比べると</h3>
          <MealCheckView results={mealCheck} mealLabel={mealLabel} />
          {missingCount > 0 ? (
            <button
              type="button"
              className="w-full rounded-xl bg-brand py-3 font-bold text-white"
              onClick={async () => {
                let n = 0;
                for (const s of selected) {
                  n += await addToShopping([...s.missingMain, ...s.missingPantry], servings, s.recipe.id);
                }
                setMessage(n > 0 ? `足りない食材 ${n}品を買い物リストに入れました` : "すでに買い物リストに入っています");
              }}
            >
              足りない食材を買い物リストに入れる
            </button>
          ) : (
            <p className="font-bold text-brand">✓ 材料はそろっています</p>
          )}
          {message && (
            <p role="status" className="font-bold text-brand">
              {message}{" "}
              <Link href="/shopping/" className="underline">
                買い物リストを見る ›
              </Link>
            </p>
          )}
        </section>
      )}

      {/* 種類 */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="tablist" aria-label="料理の種類">
        {KINDS.map((k) => {
          const n = selected.filter((s) => s.recipe.kind === k).length;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg py-2 font-bold ${kind === k ? "bg-brand text-white" : "text-ink-soft"}`}
            >
              {k}
              {n > 0 && <span className="block text-xs font-normal">{n}品選択</span>}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={softOnly}
          onChange={(e) => setSoftOnly(e.target.checked)}
          className="size-6 accent-brand"
        />
        <span className="font-bold">やわらかい料理だけ</span>
      </label>

      <p className="text-sm text-ink-soft">家にある食材で作れるものから順に並べています。</p>

      <ul className="space-y-3">
        {list.map((s) => (
          <SuggestionCard
            key={s.recipe.id}
            s={s}
            selected={plan.selected.includes(s.recipe.id)}
            overs={checkMeal(people, [s.recipe], pct).filter((r) => r.overs.length > 0)}
            mealLabel={mealLabel}
          />
        ))}
        {list.length === 0 && <li className="text-ink-soft">この条件に合う料理がありません。</li>}
      </ul>
    </div>
  );
}

function names(ids: string[]) {
  return ids.map((id) => foodById(id)?.name ?? id).join("、");
}

function SuggestionCard({
  s,
  selected,
  overs,
  mealLabel,
}: {
  s: Suggestion;
  selected: boolean;
  overs: ReturnType<typeof checkMeal>;
  mealLabel: string;
}) {
  const r = s.recipe;
  const n = recipeNutrition(r);
  const ready = s.missingMain.length === 0 && s.missingPantry.length === 0;
  return (
    <li className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${selected ? "ring-2 ring-brand" : "ring-line"}`} data-recipe={r.id}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/recipe/?id=${r.id}`} className="text-lg font-bold underline decoration-line underline-offset-4">
          {r.name}
        </Link>
        <span className="shrink-0 text-sm text-ink-soft">{r.minutes}分</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        1人分：{Math.round(n.kcal)}kcal・食塩{(Math.round(n.salt * 10) / 10).toFixed(1)}g
        {r.flags.soft && "・やわらか"}
      </p>

      {ready ? (
        <p className="mt-2 font-bold text-brand">✓ 家にある材料で作れます</p>
      ) : (
        <div className="mt-2 space-y-1">
          {s.missingMain.length > 0 && (
            <p>
              <span className="font-bold">足りない：</span>
              {names(s.missingMain.map((i) => i.foodId))}
            </p>
          )}
          {s.missingPantry.length > 0 && (
            <p className="text-sm text-ink-soft">
              <span className="font-bold">調味料など：</span>
              {names(s.missingPantry.map((i) => i.foodId))}
            </p>
          )}
        </div>
      )}
      {s.usesSoon.length > 0 && <p className="mt-1 font-bold">⏰ 期限が近い {names(s.usesSoon)} を使います</p>}
      {overs.map((o) => (
        <p key={o.person.id} className="mt-1 text-sm font-bold text-danger">
          ⚠ {o.person.nickname}：この1品だけで{mealLabel}の目安を超える（
          {o.overs.map((c) => (c.nutrient === "salt" ? "食塩" : c.nutrient === "energy" ? "カロリー" : c.nutrient === "protein" ? "たんぱく質" : c.nutrient === "potassium" ? "カリウム" : "リン")).join("・")}
          ）
        </p>
      ))}

      <button
        type="button"
        aria-pressed={selected}
        onClick={() => toggleSelected(r.id)}
        className={`mt-3 w-full rounded-lg py-2 font-bold ${selected ? "bg-brand-soft text-brand ring-2 ring-brand" : "bg-brand text-white"}`}
      >
        {selected ? "✓ 選んでいます（外す）" : "この料理を選ぶ"}
      </button>
    </li>
  );
}
