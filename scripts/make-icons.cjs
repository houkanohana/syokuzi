/* eslint-disable @typescript-eslint/no-require-imports -- 入っている Playwright を読むため require を使う */
// アプリのアイコン（PNG）を作る。絵を変えたら `node scripts/make-icons.cjs` で作り直す。
// 絵は下の SVG（お茶わんと湯気と葉っぱ）。Playwright（入っているブラウザ）で画像にする。
const { chromium } = require("playwright");
const { writeFileSync } = require("node:fs");

const BG = "#2f7a4d";

// scale：絵の大きさ（maskable は端が丸く切られるので小さめ）
function svg({ rounded, scale }) {
  const r = rounded ? 96 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${r}" fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <!-- 湯気 -->
    <g fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.9">
      <path d="M200 150 q-22 -30 0 -60 q22 -30 0 -60" transform="translate(0 40)"/>
      <path d="M256 150 q-22 -30 0 -60 q22 -30 0 -60" transform="translate(0 30)"/>
      <path d="M312 150 q-22 -30 0 -60 q22 -30 0 -60" transform="translate(0 40)"/>
    </g>
    <!-- お茶わん -->
    <path d="M96 236 h320 a160 150 0 0 1 -320 0 z" fill="#ffffff"/>
    <rect x="196" y="376" width="120" height="26" rx="10" fill="#ffffff"/>
    <!-- 葉っぱ -->
    <path d="M330 300 c40 -10 70 -40 74 -80 c-40 4 -70 34 -74 80 z" fill="#8cc79f"/>
  </g>
</svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const shots = [
    { file: "public/icons/icon-512.png", size: 512, rounded: true, scale: 0.9 },
    { file: "public/icons/icon-192.png", size: 192, rounded: true, scale: 0.9 },
    { file: "public/icons/maskable-512.png", size: 512, rounded: false, scale: 0.72 },
    // iPhone のホーム画面用（角は iPhone が自分で丸める）
    { file: "src/app/apple-icon.png", size: 180, rounded: false, scale: 0.85 },
    { file: "src/app/icon.png", size: 64, rounded: true, scale: 0.9 },
  ];
  for (const s of shots) {
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg(s).replace(
        'width="512" height="512"',
        `width="${s.size}" height="${s.size}"`
      )}</body></html>`
    );
    writeFileSync(s.file, await page.screenshot({ omitBackground: true }));
    console.log("作成:", s.file);
  }
  await browser.close();
})();
