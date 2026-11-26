import { StockView } from "./stock-view";

export default function StockPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">在庫</h1>
      <StockView />
    </div>
  );
}
