// 家族1人ずつの「1食の目安」との比べ方の表示
import type { PersonMealCheck } from "@/lib/plan";
import { NUTRIENT_INFO } from "@/lib/targets";

function fmt(n: number, digits: number) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

export function MealCheckView({ results, mealLabel }: { results: PersonMealCheck[]; mealLabel: string }) {
  if (results.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-soft">
        「わたし・家族」で体の状態を登録すると、1人ずつ目安と比べられます。
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {results.map(({ person, checks, overs }) => {
        const unknown = checks.filter((c) => c.status === "unknown");
        return (
          <li key={person.id} className="rounded-lg bg-page p-3 ring-1 ring-line" data-person={person.nickname}>
            <p className="font-bold">{person.nickname || "（呼び名なし）"}</p>
            {overs.length === 0 ? (
              <p className="text-brand">✓ {mealLabel}の目安の中です</p>
            ) : (
              overs.map((c) => {
                const info = NUTRIENT_INFO[c.nutrient];
                const digits = c.nutrient === "salt" || c.nutrient === "protein" ? 1 : 0;
                return (
                  <p key={c.nutrient} className="font-bold text-danger">
                    ⚠ {info.label}が多め：{fmt(c.value, digits)}
                    {info.unit}（{mealLabel}の目安 {c.limitText}）
                  </p>
                );
              })
            )}
            {unknown.length > 0 && (
              <p className="text-sm text-ink-soft">
                {unknown.map((c) => NUTRIENT_INFO[c.nutrient].label).join("・")}
                ：目安が決まっていないため比べていません（病院の指示を入れると比べられます）
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
