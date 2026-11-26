import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// テストでも「@/〜」で src/ を指せるようにする（tsconfig.json の paths と同じ）
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
