// ビルドのあとに動かす：out/ にできたファイルの一覧を入れた「サービスワーカー」を作る。
// サービスワーカー＝スマホの中でアプリのファイルを預かり、電波がなくても開けるようにする仕組み。
// ファイルの中身が変わると版（VERSION）が変わり、スマホ側の預かり分が自動で新しくなる。
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(OUT)
  .map((p) => relative(OUT, p).split(sep).join("/"))
  .filter((p) => p !== "sw.js" && !p.endsWith(".map"))
  .sort();

const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

// "a/b/index.html" は "/a/b/" でも開けるように、両方を預かる
const urls = files.flatMap((f) => {
  const url = "/" + f;
  if (f === "index.html") return ["/", url];
  if (f.endsWith("/index.html")) return [url.slice(0, -"index.html".length), url];
  return [url];
});

const sw = `// このファイルはビルドのたびに scripts/generate-sw.mjs が作る。手で直さない。
const VERSION = ${JSON.stringify(version)};
const CACHE = "app-" + VERSION;
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 預かっているものはすぐ返す。無いものは取りに行く。
  // ページの移動で見つからないときは、トップの画面を返す（電波がないときの保険）
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() =>
        req.mode === "navigate" ? caches.match("/") : Response.error()
      );
    })
  );
});
`;

writeFileSync(join(OUT, "sw.js"), sw);
console.log(`sw.js を作りました（版 ${version}・${urls.length} 件）`);
