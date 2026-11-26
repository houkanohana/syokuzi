import { Suspense } from "react";
import { PersonEditor } from "./person-editor";

// 1人分の体の状態と、1日の目安。どの人かは ?id= で受け取る
// （サーバーを使わない書き出しなので、/profile/person/3 の形ではなく ?id=3 の形にしている）
export default function PersonPage() {
  return (
    <Suspense fallback={<div className="h-40" aria-busy="true" />}>
      <PersonEditor />
    </Suspense>
  );
}
