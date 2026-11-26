import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { ConsentGate } from "@/components/consent-gate";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

// アプリの名前はまだ決まっていない。決まったらここと manifest.ts を直す
export const metadata: Metadata = {
  title: "食事管理アプリ",
  description: "家の在庫から、体の状態に合わせた献立を提案します",
  appleWebApp: { capable: true, title: "食事管理", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2f7a4d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <ServiceWorkerRegister />
        <ConsentGate>
          <main
            className="mx-auto w-full max-w-xl flex-1 px-4 pt-6"
            style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
          >
            {children}
          </main>
          <BottomNav />
        </ConsentGate>
      </body>
    </html>
  );
}
