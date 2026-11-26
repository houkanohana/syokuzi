"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { db, type Person } from "@/lib/db";
import { CANCER_SYMPTOM_LABEL, savePerson } from "@/lib/people";
import {
  CKD_LABEL,
  COMPARE_LABEL,
  DEFAULT_COMPARE,
  NUTRIENTS,
  NUTRIENT_INFO,
  computeTargets,
  formatTarget,
  type Activity,
  type Ascites,
  type CancerSymptom,
  type CkdStage,
  type Compare,
  type Conditions,
  type Nutrient,
  type TargetResult,
} from "@/lib/targets";
import { SOURCES } from "@/lib/targets-data";

export function PersonEditor() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  // null＝見つからない、undefined＝読み込み中
  const person = useLiveQuery(async () => (await db.people.get(id)) ?? null, [id]);

  if (person === undefined) return <div className="h-40" aria-busy="true" />;
  if (person === null) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-white p-4 ring-1 ring-line">この人の登録が見つかりませんでした。</p>
        <Link href="/profile/" className="font-bold text-brand">
          ‹ 一覧にもどる
        </Link>
      </div>
    );
  }
  // 読み込んだら、あとは画面の中で持って、変えるたびに保存する
  return <PersonForm key={person.id} initial={person} />;
}

function PersonForm({ initial }: { initial: Person }) {
  const router = useRouter();
  const [p, setP] = useState<Person>(initial);
  const first = useRef(true);

  // 変えるたびに自動で保存する（保存ボタンを押し忘れないように）
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    savePerson(p);
  }, [p]);

  const set = (patch: Partial<Person>) => setP((cur) => ({ ...cur, ...patch }));
  const setC = (patch: Partial<Conditions>) =>
    setP((cur) => ({ ...cur, conditions: { ...cur.conditions, ...patch } }));

  const t = computeTargets(p);
  const c = p.conditions;

  return (
    <div className="space-y-4">
      <Link href="/profile/" className="inline-block font-bold text-brand">
        ‹ 家族の一覧
      </Link>
      <h1 className="text-2xl font-bold">{p.nickname || "（呼び名なし）"}</h1>
      <p className="text-sm text-ink-soft">入力すると、自動で保存されます。</p>

      {/* 体のこと */}
      <Card title="体のこと">
        <Field label="呼び名">
          <input
            type="text"
            value={p.nickname}
            maxLength={20}
            placeholder="例：本人、父"
            onChange={(e) => set({ nickname: e.target.value })}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="年齢" unit="歳" value={p.age} min={1} max={120} onChange={(v) => set({ age: v })} />
          <Field label="性別">
            <div className="flex gap-2">
              {(
                [
                  ["male", "男性"],
                  ["female", "女性"],
                ] as const
              ).map(([v, l]) => (
                <Choice key={v} checked={p.sex === v} onClick={() => set({ sex: v })}>
                  {l}
                </Choice>
              ))}
            </div>
          </Field>
          <NumberField
            label="身長"
            unit="cm"
            value={p.heightCm}
            min={50}
            max={250}
            decimal
            onChange={(v) => set({ heightCm: v })}
          />
          <NumberField
            label="体重"
            unit="kg"
            value={p.weightKg}
            min={5}
            max={300}
            decimal
            onChange={(v) => set({ weightKg: v })}
          />
        </div>
        {t.bmi !== null && (
          <p className="text-ink-soft">
            BMI {t.bmi}（標準体重 {t.standardWeight}kg）
          </p>
        )}
        <Field label="ふだんの体の動かし方">
          <div className="space-y-2">
            {(
              [
                ["low", "低い", "生活の大部分が座ったまま。家でほとんど外出しない"],
                ["normal", "ふつう", "座ることが多いが、家事・買い物・通勤などで動く"],
                ["high", "高い", "立ち仕事や力仕事が多い、またはよく運動する"],
              ] as [Activity, string, string][]
            ).map(([v, l, d]) => (
              <Choice key={v} checked={p.activity === v} onClick={() => set({ activity: v })} block>
                <span className="font-bold">{l}</span>
                <span className="block text-sm font-normal text-ink-soft">{d}</span>
              </Choice>
            ))}
          </div>
        </Field>
      </Card>

      {/* 病気・症状 */}
      <Card title="病気・症状（あてはまるものすべて）">
        <Check label="高血圧" checked={c.hypertension} onChange={(v) => setC({ hypertension: v })} />
        <Check label="糖尿病" checked={c.diabetes} onChange={(v) => setC({ diabetes: v })} />
        <Check label="心不全" checked={c.heartFailure} onChange={(v) => setC({ heartFailure: v })} />

        <Check
          label="腎臓病（慢性腎臓病）"
          checked={c.ckd !== null}
          onChange={(v) => setC({ ckd: v ? "unknown" : null })}
        />
        {c.ckd !== null && (
          <Sub title="ステージ（主治医に聞いたもの）">
            <div className="grid grid-cols-3 gap-2">
              {(["G1", "G2", "G3a", "G3b", "G4", "G5"] as CkdStage[]).map((s) => (
                <Choice key={s} checked={c.ckd === s} onClick={() => setC({ ckd: s })}>
                  {CKD_LABEL[s]}
                </Choice>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["HD", "PD"] as CkdStage[]).map((s) => (
                <Choice key={s} checked={c.ckd === s} onClick={() => setC({ ckd: s })}>
                  {CKD_LABEL[s]}
                </Choice>
              ))}
            </div>
            <div className="mt-2">
              <Choice checked={c.ckd === "unknown"} onClick={() => setC({ ckd: "unknown" })} block>
                分からない
              </Choice>
            </div>
          </Sub>
        )}

        <Check
          label="肝硬変"
          checked={c.cirrhosis !== null}
          onChange={(v) => setC({ cirrhosis: v ? "unknown" : null })}
        />
        {c.cirrhosis !== null && (
          <Sub title="腹水（おなかに水がたまる）">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["yes", "あり"],
                  ["no", "なし"],
                  ["unknown", "分からない"],
                ] as [Ascites, string][]
              ).map(([v, l]) => (
                <Choice key={v} checked={c.cirrhosis === v} onClick={() => setC({ cirrhosis: v })}>
                  {l}
                </Choice>
              ))}
            </div>
          </Sub>
        )}

        <Check
          label="抗がん剤などの副作用"
          checked={c.cancer !== null}
          onChange={(v) => setC({ cancer: v ? { symptoms: [], avoidRaw: false } : null })}
        />
        {c.cancer !== null && (
          <Sub title="いまの症状（あてはまるもの）">
            <div className="space-y-1">
              {(Object.keys(CANCER_SYMPTOM_LABEL) as CancerSymptom[]).map((s) => (
                <Check
                  key={s}
                  small
                  label={CANCER_SYMPTOM_LABEL[s]}
                  checked={c.cancer!.symptoms.includes(s)}
                  onChange={(v) =>
                    setC({
                      cancer: {
                        ...c.cancer!,
                        symptoms: v
                          ? [...c.cancer!.symptoms, s]
                          : c.cancer!.symptoms.filter((x) => x !== s),
                      },
                    })
                  }
                />
              ))}
              <Check
                small
                label="白血球が下がっていて、生ものを避けるよう言われている"
                checked={c.cancer.avoidRaw}
                onChange={(v) => setC({ cancer: { ...c.cancer!, avoidRaw: v } })}
              />
            </div>
          </Sub>
        )}

        <Check label="ダイエット" checked={c.diet} onChange={(v) => setC({ diet: v })} />
      </Card>

      {/* 1日の目安 */}
      <Card title="1日の目安">
        {t.notices.length > 0 && (
          <ul className="space-y-2">
            {t.notices.map((n) => (
              <li key={n} className="rounded-lg bg-notice px-3 py-2 leading-relaxed ring-1 ring-notice-line">
                ⚠ {n}
              </li>
            ))}
          </ul>
        )}
        <ul className="space-y-3">
          {NUTRIENTS.map((n) => (
            <TargetRow
              key={n}
              nutrient={n}
              result={t.results[n]}
              instruction={p.instructions[n]}
              onInstruction={(ins) => {
                const next = { ...p.instructions };
                if (ins) next[n] = ins;
                else delete next[n];
                set({ instructions: next });
              }}
            />
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-ink-soft">
          目安は、学会・国の資料をもとにした一般的な値です。主治医・管理栄養士の指示があるときは、「病院の指示」に入れてください。指示がいちばん優先されます。
        </p>
      </Card>

      <button
        type="button"
        className="w-full rounded-xl border-2 border-danger py-3 font-bold text-danger"
        onClick={async () => {
          if (!window.confirm(`「${p.nickname || "この人"}」の登録を消しますか？元にはもどせません。`)) return;
          await db.people.delete(p.id);
          router.push("/profile/");
        }}
      >
        この人の登録を消す
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1日の目安の1行（自動の目安と、病院の指示の入力）

function TargetRow({
  nutrient,
  result,
  instruction,
  onInstruction,
}: {
  nutrient: Nutrient;
  result: TargetResult;
  instruction: { value: number; compare: Compare } | undefined;
  onInstruction: (ins: { value: number; compare: Compare } | null) => void;
}) {
  const info = NUTRIENT_INFO[nutrient];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(instruction ? String(instruction.value) : "");
  const [compare, setCompare] = useState<Compare>(instruction?.compare ?? DEFAULT_COMPARE[nutrient]);

  const isInstr = result.status === "instruction";
  const need = result.status === "needInstruction";
  const reasons = "reasons" in result ? result.reasons : [];
  const notes = result.status === "value" || result.status === "text" ? result.notes : [];
  const messages = result.status === "needInstruction" ? result.messages : [];

  const commit = (raw: string, cmp: Compare) => {
    const v = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(v) || v <= 0) onInstruction(null);
    else onInstruction({ value: v, compare: cmp });
  };

  return (
    <li
      className={`rounded-xl p-3 ring-1 ${need ? "bg-notice ring-notice-line" : "bg-page ring-line"}`}
      data-nutrient={nutrient}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{info.label}</span>
        {isInstr && (
          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
            病院の指示
          </span>
        )}
      </div>
      <p className={`mt-1 text-xl font-bold ${need ? "text-ink" : "text-brand"}`} data-testid={`target-${nutrient}`}>
        {formatTarget(nutrient, result)}
      </p>
      {messages.map((m) => (
        <p key={m} className="mt-1 leading-relaxed">
          {m}
        </p>
      ))}
      {notes.map((m) => (
        <p key={m} className="mt-1 text-sm leading-relaxed text-ink-soft">
          ・{m}
        </p>
      ))}

      {/* 病院の指示 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">病院の指示</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${info.label}の病院の指示`}
          value={value}
          placeholder="なし"
          onChange={(e) => {
            const raw = e.target.value.replace(/[０-９．]/g, (ch) =>
              String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
            );
            setValue(raw);
            commit(raw, compare);
          }}
          className="input w-24 text-right"
        />
        <span>{info.unit}</span>
        <select
          aria-label={`${info.label}の指示の比べ方`}
          value={compare}
          onChange={(e) => {
            const cmp = e.target.value as Compare;
            setCompare(cmp);
            commit(value, cmp);
          }}
          className="input w-auto py-2"
        >
          {(Object.keys(COMPARE_LABEL) as Compare[]).map((k) => (
            <option key={k} value={k}>
              {COMPARE_LABEL[k]}
            </option>
          ))}
        </select>
        {instruction && (
          <button
            type="button"
            className="text-sm font-bold text-ink-soft underline"
            onClick={() => {
              setValue("");
              onInstruction(null);
            }}
          >
            消す
          </button>
        )}
      </div>

      {reasons.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="text-sm font-bold text-brand"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "▲ 根拠を閉じる" : "▼ 根拠（どの病気・どの資料から）"}
          </button>
          {open && (
            <ul className="mt-1 space-y-1 text-sm leading-relaxed">
              {reasons.map((r, i) => (
                <li key={i}>
                  <span className="font-bold">{r.label}</span>
                  {r.detail && `：${r.detail}`}
                  {r.source && (
                    <>
                      {" "}
                      （
                      <a href={SOURCES[r.source].url} target="_blank" rel="noopener noreferrer" className="underline">
                        {SOURCES[r.source].title}
                      </a>
                      ）
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// 小さな部品

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ml-3 border-l-4 border-brand-soft pl-3">
      <p className="mb-2 text-sm font-bold text-ink-soft">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-bold">{label}</span>
      {children}
    </div>
  );
}

function Choice({
  checked,
  onClick,
  children,
  block,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={`${block ? "w-full text-left" : "flex-1 text-center"} rounded-lg px-3 py-2 font-bold ring-2 ${
        checked ? "bg-brand-soft text-brand ring-brand" : "bg-white text-ink ring-line"
      }`}
    >
      {children}
    </button>
  );
}

function Check({
  label,
  checked,
  onChange,
  small,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  small?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${small ? "py-1" : "py-2"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-6 shrink-0 accent-brand"
      />
      <span className={small ? "" : "font-bold"}>{label}</span>
    </label>
  );
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  decimal,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  min: number;
  max: number;
  decimal?: boolean;
  onChange: (v: number | null) => void;
}) {
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  const n = Number(raw);
  const invalid = raw.trim() !== "" && (!Number.isFinite(n) || n < min || n > max);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          aria-label={label}
          value={raw}
          onChange={(e) => {
            // 全角の数字も受け付ける
            const v = e.target.value.replace(/[０-９．]/g, (ch) =>
              String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
            );
            setRaw(v);
            const num = Number(v);
            if (v.trim() === "") onChange(null);
            else if (Number.isFinite(num) && num >= min && num <= max) onChange(num);
          }}
          className={`input w-full text-right ${invalid ? "ring-2 ring-danger" : ""}`}
        />
        <span className="shrink-0">{unit}</span>
      </div>
      {invalid && (
        <p className="text-sm text-danger">
          {min}〜{max}{unit}の数字を入れてください
        </p>
      )}
    </Field>
  );
}
