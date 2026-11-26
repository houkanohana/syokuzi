import { ComingSoon } from "@/components/coming-soon";

export default function ShoppingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">買い物リスト</h1>
      <ComingSoon>選んだ料理に足りない食材が、ここに自動で並びます。</ComingSoon>
    </div>
  );
}
