import Link from "next/link";
import { PantryView } from "./pantry-view";

export default function PantryPage() {
  return (
    <div className="space-y-4">
      <Link href="/stock/" className="inline-block font-bold text-brand">
        ‹ 在庫
      </Link>
      <h1 className="text-2xl font-bold">家にある調味料</h1>
      <p className="leading-relaxed text-ink-soft">
        家にある調味料・油・粉にチェックを入れてください。献立の「足りない食材」を出すときに使います。量や期限は入れなくて大丈夫です。
      </p>
      <PantryView />
    </div>
  );
}
