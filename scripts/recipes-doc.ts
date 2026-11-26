// レシピ集の確認用の資料（docs/レシピ案.md）を、レシピのデータから作る。
// 使い方：npm run docs:recipes
import { writeFileSync } from "node:fs";
import { RECIPES } from "@/data/recipes";
import { FOOD_SOURCE, foodById } from "@/lib/foods";
import { TIP_LABEL, isRawRecipe, recipeNutrition, roundNutrition, youtubeUrl, type TipKey } from "@/lib/recipes";

const lines: string[] = [];
const p = (s = "") => lines.push(s);

p("# レシピ案（確認用）");
p();
p("> このファイルは `npm run docs:recipes` で `src/data/recipes.ts` から自動で作っています。直すときはレシピのデータを直してください。");
p();
p(`- レシピの数：${RECIPES.length}品（すべてオリジナル）`);
p("- 分量は**1人分**、皮・種・骨などを除いた**正味のg**です。「目安」は家庭での量の目安です");
p("- 栄養は、材料のgと食品成分表から自動で計算しています（AIは使っていません）");
p("- 生の数値で計算しているので、ゆでこぼし・水さらしで減るカリウムや、残した煮汁の塩分は引いていません（実際より多めに出ます）");
p(`- 食材の数値：${FOOD_SOURCE}`);
p("- 症状別のコツは、国立がん研究センター「がん情報サービス」の症状別ページを参考に書いています");
p();
p("## 一覧（1人分）");
p();
p("| | 料理 | 種類 | カロリー | たんぱく質 | 食塩 | カリウム | リン | 生もの | やわらか |");
p("|---|---|---|---|---|---|---|---|---|---|");
RECIPES.forEach((r, i) => {
  const n = roundNutrition(recipeNutrition(r));
  p(
    `| ${i + 1} | ${r.name} | ${r.kind} | ${n.kcal}kcal | ${n.protein}g | ${n.salt}g | ${n.potassium}mg | ${n.phosphorus}mg | ${
      isRawRecipe(r) ? "あり" : ""
    } | ${r.flags.soft ? "○" : ""} |`
  );
});
p();

for (const [i, r] of RECIPES.entries()) {
  const n = roundNutrition(recipeNutrition(r));
  p(`## ${i + 1}. ${r.name}`);
  p();
  p(`${r.kind}・約${r.minutes}分　／　1人分：${n.kcal}kcal・たんぱく質${n.protein}g・食塩${n.salt}g・カリウム${n.potassium}mg・リン${n.phosphorus}mg・炭水化物${n.carb}g`);
  p();
  p("**材料（1人分）**");
  p();
  p("| 材料 | g | 目安 | 下ごしらえ |");
  p("|---|---|---|---|");
  for (const ing of r.ingredients) {
    const f = foodById(ing.foodId)!;
    p(`| ${f.name} | ${ing.grams} | ${ing.label ?? ""} | ${ing.note ?? ""} |`);
  }
  for (const e of r.extras ?? []) p(`| ${e} | | | （計算に入れていません） |`);
  p();
  p("**作り方**");
  p();
  r.steps.forEach((s, j) => p(`${j + 1}. ${s}`));
  p();
  const keys = Object.keys(r.tips) as TipKey[];
  if (keys.length > 0) {
    p("**病気・症状に合わせたコツ**");
    p();
    for (const k of keys) p(`- **${TIP_LABEL[k]}**：${r.tips[k]}`);
    p();
  }
  const flags = [
    r.flags.rawMeatFish && "生の肉・魚",
    r.flags.rawVeg && "生野菜",
    r.flags.fermented && "加熱しない発酵食品",
    r.flags.driedFruit && "ドライフルーツ",
  ].filter(Boolean);
  if (flags.length > 0) p(`**生ものの印**：${flags.join("・")}（「生ものを避ける」を選んだ人には出しません）`);
  p();
  p(`**動画**：[YouTubeで「${r.youtube}」を探す](${youtubeUrl(r)})`);
  p();
}

writeFileSync("docs/レシピ案.md", lines.join("\n"));
console.log(`docs/レシピ案.md を作りました（${RECIPES.length}品）`);
