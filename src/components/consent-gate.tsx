"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, requestPersistentStorage, setSetting } from "@/lib/db";
import { DISCLAIMER_VERSION, type Consent } from "@/lib/disclaimer";
import { DisclaimerView } from "./disclaimer-view";

/**
 * 「はじめに」（免責）に同意するまで、アプリの中身を出さない。
 * 文面の版（DISCLAIMER_VERSION）が変わったら、もう一度同意してもらう。
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  // undefined＝読み込み中、null＝まだ同意していない
  const consent = useLiveQuery(async () => {
    const row = await db.settings.get("consent");
    return (row?.value as Consent | undefined) ?? null;
  });

  if (consent === undefined) {
    return <div className="flex-1" aria-busy="true" />;
  }

  if (consent === null || consent.version !== DISCLAIMER_VERSION) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
        <h1 className="text-2xl font-bold">はじめに</h1>
        <p className="mt-2 mb-4 leading-relaxed text-ink-soft">
          使い始める前に、次の内容をお読みください。
        </p>
        <DisclaimerView
          onAgree={async () => {
            const value: Consent = {
              version: DISCLAIMER_VERSION,
              agreedAt: new Date().toISOString(),
            };
            await setSetting("consent", value);
            await requestPersistentStorage();
          }}
        />
      </main>
    );
  }

  return <>{children}</>;
}
