"use client";

import { useSyncExternalStore } from "react";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iPhone の Safari 独自の目印
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * ホーム画面に追加していないときだけ、追加のしかたを出す。
 * iPhone の Safari は、ホーム画面に追加していないと、7日間開かないだけでデータを消すことがあるため。
 */
export function InstallHint() {
  const standalone = useSyncExternalStore(
    () => () => {},
    isStandalone,
    () => true // 書き出し時（サーバー側）は出さない
  );
  if (standalone) return null;

  return (
    <section className="rounded-xl bg-notice p-4 ring-1 ring-notice-line">
      <p className="font-bold">📱 ホーム画面に追加してください</p>
      <p className="mt-1 leading-relaxed">
        追加すると、アプリのように開けて、入力したデータも消えにくくなります。
      </p>
      <ul className="mt-2 space-y-1 leading-relaxed">
        <li>
          <span className="font-bold">iPhone：</span>
          Safari の下の「共有」ボタン（四角から矢印）→「ホーム画面に追加」
        </li>
        <li>
          <span className="font-bold">Android：</span>
          Chrome の右上「︙」→「ホーム画面に追加」または「アプリをインストール」
        </li>
      </ul>
    </section>
  );
}
