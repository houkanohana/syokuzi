import type { NextConfig } from "next";

// 第1段階はサーバーを使わない。`next build` で out/ にHTMLなどを書き出し、
// それを無料の公開先（Cloudflare Pages の予定）にそのまま置く。
const nextConfig: NextConfig = {
  output: "export",
  // /stock → /stock/index.html の形で書き出す（公開先でページが見つからない事故を防ぐ）
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
