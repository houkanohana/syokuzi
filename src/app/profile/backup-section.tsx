"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { LAST_BACKUP_KEY, exportBackup, importBackup, parseBackup } from "@/lib/backup";
import { getSetting } from "@/lib/db";

/** バックアップ（書き出し・読み込み） */
export function BackupSection() {
  const last = useLiveQuery(async () => (await getSetting<string>(LAST_BACKUP_KEY)) ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
      <h2 className="text-lg font-bold">バックアップ</h2>
      <p className="leading-relaxed text-ink-soft">
        データはこのスマホの中だけにあります。機種変更やブラウザのデータ削除に備えて、ときどきファイルに書き出してください。
      </p>
      <p className="text-sm text-ink-soft">
        最後に書き出した日：
        {last === undefined
          ? "確認中…"
          : last === null
            ? "まだありません"
            : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date(last))}
      </p>

      <button
        type="button"
        className="w-full rounded-xl bg-brand py-3 font-bold text-white"
        onClick={async () => {
          setMessage(null);
          const { json, fileName } = await exportBackup();
          const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
          setMessage({ ok: true, text: `「${fileName}」を書き出しました` });
        }}
      >
        ファイルに書き出す
      </button>

      <button
        type="button"
        className="w-full rounded-xl border-2 border-brand py-3 font-bold text-brand"
        onClick={() => fileRef.current?.click()}
      >
        ファイルから読み込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="バックアップファイルを選ぶ"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setMessage(null);
          try {
            const data = parseBackup(await f.text());
            const ok = window.confirm(
              `今のデータを消して、ファイルの中身（家族 ${data.people.length}人）に置きかえます。よろしいですか？`
            );
            if (!ok) return;
            await importBackup(data);
            setMessage({ ok: true, text: "読み込みました" });
          } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "読み込めませんでした" });
          }
        }}
      />
      {message && (
        <p role="status" className={`font-bold ${message.ok ? "text-brand" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
