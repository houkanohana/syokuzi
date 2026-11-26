import { ComingSoon } from "@/components/coming-soon";
import { InstallHint } from "@/components/install-hint";

export default function MenuPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">献立</h1>
      <InstallHint />
      <ComingSoon>
        ここに、家の在庫で作れる料理が並びます。足りない食材が少ない順に出し、目安を超える料理には印を付けます。
      </ComingSoon>
    </div>
  );
}
