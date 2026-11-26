"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MealCheckView } from "@/components/meal-check-view";
import { RECIPES } from "@/data/recipes";
import { FOOD_SOURCE, foodById } from "@/lib/foods";
import { MEAL_LABEL, anyAvoidRaw, checkMeal, relevantTips, servingsOf, suggest } from "@/lib/plan";
import { addToShopping, toggleSelected } from "@/lib/plan-store";
import { TIP_LABEL, isRawRecipe, recipeNutrition, roundNutrition, youtubeUrl, type TipKey } from "@/lib/recipes";
import { todayTokyo } from "@/lib/stock";
import { useHousehold } from "@/lib/use-household";

function grams(n: number) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

export function RecipeView() {
  const id = useSearchParams().get("id");
  const recipe = RECIPES.find((r) => r.id === id);
  const h = useHousehold();
  const [showOther, setShowOther] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!recipe) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-white p-4 ring-1 ring-line">この料理が見つかりませんでした。</p>
        <Link href="/" className="font-bold text-brand">
          ‹ 献立にもどる
        </Link>
      </div>
    );
  }
  if (!h) return <div className="h-40" aria-busy="true" />;

  const servings = servingsOf(h.people, h.extra);
  const n = roundNutrition(recipeNutrition(recipe));
  const s = suggest([recipe], { stock: h.stock, pantry: h.pantry, avoidRaw: false, softOnly: false, today: todayTokyo() })[0];
  const missing = new Set([...s.missingMain, ...s.missingPantry].map((i) => i.foodId));
  const subs = new Map(s.substitutions.map((x) => [x.ingredient.foodId, x.useFoodId]));
  const tips = relevantTips(h.people);
  const tipKeys = Object.keys(recipe.tips) as TipKey[];
  const mine = tipKeys.filter((k) => tips.has(k));
  const others = tipKeys.filter((k) => !tips.has(k));
  const selected = h.plan.selected.includes(recipe.id);
  const mealLabel = MEAL_LABEL[h.plan.meal];
  const check = checkMeal(h.people, [recipe], h.ratio[h.plan.meal]);
  const avoidRaw = anyAvoidRaw(h.people);

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block font-bold text-brand">
        ‹ 献立
      </Link>
      <div>
        <p className="text-sm font-bold text-ink-soft">
          {recipe.kind}・約{recipe.minutes}分{recipe.flags.soft && "・やわらか"}
        </p>
        <h1 className="text-2xl font-bold">{recipe.name}</h1>
      </div>

      {avoidRaw && isRawRecipe(recipe) && (
        <p className="rounded-xl bg-notice p-3 font-bold leading-relaxed ring-1 ring-notice-line">
          ⚠ 生ものを使う料理です。生ものを避けるよう言われている方は、下の「生もの・衛生」のコツを見てください。
        </p>
      )}

      <button
        type="button"
        aria-pressed={selected}
        onClick={() => toggleSelected(recipe.id)}
        className={`w-full rounded-xl py-3 text-lg font-bold ${selected ? "bg-brand-soft text-brand ring-2 ring-brand" : "bg-brand text-white"}`}
      >
        {selected ? `✓ ${mealLabel}ごはんに選んでいます（外す）` : `${mealLabel}ごはんに選ぶ`}
      </button>

      {/* 栄養 */}
      <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="text-lg font-bold">1人分の栄養</h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["カロリー", `${n.kcal}kcal`],
            ["たんぱく質", `${n.protein}g`],
            ["食塩", `${n.salt.toFixed(1)}g`],
            ["カリウム", `${n.potassium}mg`],
            ["リン", `${n.phosphorus}mg`],
            ["炭水化物", `${n.carb}g`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-page p-2">
              <dt className="text-xs text-ink-soft">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-ink-soft">
          材料の重さと食品成分表から計算した目安です。ゆでこぼしで減るカリウムや、残した煮汁の塩分は引いていません（実際より多めに出ます）。
        </p>
        {h.people.length > 0 && (
          <>
            <h3 className="font-bold">この1品だけを、{mealLabel}の目安と比べると</h3>
            <MealCheckView results={check} mealLabel={mealLabel} />
          </>
        )}
      </section>

      {/* 材料 */}
      <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="text-lg font-bold">材料（{servings}人分）</h2>
        <ul className="divide-y divide-line">
          {recipe.ingredients.map((ing) => {
            const f = foodById(ing.foodId)!;
            const sub = subs.get(ing.foodId);
            const lack = missing.has(ing.foodId);
            return (
              <li key={ing.foodId} className="flex items-start gap-3 py-2">
                <span aria-hidden="true" className={`mt-0.5 font-bold ${lack ? "text-danger" : "text-brand"}`}>
                  {lack ? "✗" : "✓"}
                </span>
                <span className="flex-1">
                  <span className="font-bold">{f.name}</span>
                  {ing.note && <span className="text-sm text-ink-soft">（{ing.note}）</span>}
                  {sub && <span className="block text-sm text-ink-soft">家にある「{foodById(sub)?.name}」で代用</span>}
                  {lack && <span className="block text-sm font-bold text-danger">家にありません</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-bold">{grams(ing.grams * servings)}g</span>
                  {ing.label && <span className="block text-xs text-ink-soft">1人分：{ing.label}</span>}
                </span>
              </li>
            );
          })}
          {(recipe.extras ?? []).map((e) => (
            <li key={e} className="py-2 text-ink-soft">
              ・{e}（1人分）
            </li>
          ))}
        </ul>
        {missing.size > 0 && (
          <button
            type="button"
            className="w-full rounded-xl border-2 border-brand py-3 font-bold text-brand"
            onClick={async () => {
              const k = await addToShopping([...s.missingMain, ...s.missingPantry], servings, recipe.id);
              setMessage(k > 0 ? `${k}品を買い物リストに入れました` : "すでに買い物リストに入っています");
            }}
          >
            足りない材料を買い物リストに入れる
          </button>
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

      {/* 作り方 */}
      <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="text-lg font-bold">作り方</h2>
        <ol className="space-y-3">
          {recipe.steps.map((st, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">
                {i + 1}
              </span>
              <span>{st}</span>
            </li>
          ))}
        </ol>
        <a
          href={youtubeUrl(recipe)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block rounded-xl bg-[#c4302b] py-3 text-center font-bold text-white"
        >
          ▶ YouTubeで作り方の動画を探す
        </a>
        <p className="text-xs text-ink-soft">YouTubeのページが開きます（動画はこのアプリのものではありません）。</p>
      </section>

      {/* コツ */}
      {tipKeys.length > 0 && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
          <h2 className="text-lg font-bold">病気・症状に合わせたコツ</h2>
          {mine.length > 0 ? (
            <ul className="space-y-2">
              {mine.map((k) => (
                <li key={k} className="rounded-lg bg-brand-soft p-3 leading-relaxed" data-tip={k}>
                  <span className="block font-bold text-brand">{TIP_LABEL[k]}</span>
                  {recipe.tips[k]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">家族の病気・症状に関係するコツはありません。</p>
          )}
          {others.length > 0 && (
            <>
              <button
                type="button"
                className="text-sm font-bold text-brand"
                aria-expanded={showOther}
                onClick={() => setShowOther(!showOther)}
              >
                {showOther ? "▲ そのほかのコツを閉じる" : `▼ そのほかのコツ（${others.length}つ）`}
              </button>
              {showOther && (
                <ul className="space-y-2">
                  {others.map((k) => (
                    <li key={k} className="rounded-lg bg-page p-3 leading-relaxed" data-tip={k}>
                      <span className="block font-bold">{TIP_LABEL[k]}</span>
                      {recipe.tips[k]}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      <p className="text-xs leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
        オリジナルのレシピです。栄養の数値：{FOOD_SOURCE}。症状別のコツは国立がん研究センター「がん情報サービス」を参考にしています。
      </p>
    </div>
  );
}
