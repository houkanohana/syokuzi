"use client";

import { useEffect } from "react";

/** 公開版でだけ、サービスワーカー（電波がなくても開ける仕組み）を登録する */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 登録できなくても、ふつうに使える（電波がないと開けないだけ）
    });
  }, []);
  return null;
}
