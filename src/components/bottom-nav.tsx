"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "献立", icon: "🍳" },
  { href: "/stock/", label: "在庫", icon: "🧊" },
  { href: "/shopping/", label: "買い物", icon: "🛒" },
  { href: "/profile/", label: "わたし", icon: "👤" },
];

/** 画面の下に固定するタブ */
export function BottomNav() {
  const pathname = usePathname();
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? norm(pathname) === "/" || norm(pathname).startsWith("/recipe/")
              : norm(pathname).startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-sm font-bold ${
                  active ? "text-brand" : "text-ink-soft"
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
