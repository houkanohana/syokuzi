import Link from "next/link";
import { BackupSection } from "./backup-section";
import { MealRatioSection } from "./meal-ratio-section";
import { PeopleSection } from "./people-section";
import { StorageStatus } from "./storage-status";

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">わたし・家族</h1>
      <PeopleSection />
      <MealRatioSection />
      <BackupSection />

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
