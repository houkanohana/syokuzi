"use client";

import { useEffect, useState } from "react";
import { requestPersistentStorage } from "@/lib/db";

/** データがこのスマホの中だけにあること、消えにくい設定になっているかを出す */
export function StorageStatus() {
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
  }, []);

  return (
    <div className="space-y-2 leading-relaxed">
      <p>
        <span className="font-bold">データの保存先：</span>このスマホの中だけ（外には送りません）
      </p>
      <p>
        <span className="font-bold">消えにくい設定：</span>
        {persisted === null ? "確認中…" : persisted ? "有効" : "まだ有効になっていません"}
      </p>
      {persisted === false && (
        <button
          type="button"
          className="rounded-lg border border-brand px-4 py-2 font-bold text-brand"
          onClick={async () => setPersisted(await requestPersistentStorage())}
        >
          消えにくい設定をお願いする
        </button>
      )}
    </div>
  );
}
