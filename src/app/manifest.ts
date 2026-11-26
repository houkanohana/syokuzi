import type { MetadataRoute } from "next";

// ホーム画面に追加したときの名前・アイコン・色
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "食事管理アプリ",
    short_name: "食事管理",
    description: "家の在庫から、体の状態に合わせた献立を提案します",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f6",
    theme_color: "#2f7a4d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
