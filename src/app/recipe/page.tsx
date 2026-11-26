import { Suspense } from "react";
import { RecipeView } from "./recipe-view";

// 料理の詳細。どの料理かは ?id= で受け取る
export default function RecipePage() {
  return (
    <Suspense fallback={<div className="h-40" aria-busy="true" />}>
      <RecipeView />
    </Suspense>
  );
}
