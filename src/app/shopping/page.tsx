import { ShoppingView } from "./shopping-view";

export default function ShoppingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">買い物リスト</h1>
      <ShoppingView />
    </div>
  );
}
