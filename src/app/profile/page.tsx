import Link from "next/link";
import { ComingSoon } from "@/components/coming-soon";
import { StorageStatus } from "./storage-status";

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">わたし</h1>
      <ComingSoon>
        何人分か、身長・体重・年齢、病気・症状、1日の目安（塩分・カロリーなど）を入れる画面です。
      </ComingSoon>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 className="text-lg font-bold">このアプリについて</h2>
        <StorageStatus />
        <Link
          href="/disclaimer/"
          className="block rounded-lg bg-brand-soft px-4 py-3 font-bold text-brand"
        >
          「はじめに」の説明をもう一度読む
        </Link>
      </section>
    </div>
  );
}
