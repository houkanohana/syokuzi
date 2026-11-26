import { InstallHint } from "@/components/install-hint";
import { MenuView } from "./menu-view";

export default function MenuPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">献立</h1>
      <InstallHint />
      <MenuView />
    </div>
  );
}
