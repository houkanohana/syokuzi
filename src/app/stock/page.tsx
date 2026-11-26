import { ComingSoon } from "@/components/coming-soon";

export default function StockPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">在庫</h1>
      <ComingSoon>冷蔵・冷凍・常温に分けて、家にある食材を登録する画面です。</ComingSoon>
    </div>
  );
}
