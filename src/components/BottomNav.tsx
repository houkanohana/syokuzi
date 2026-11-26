import {
  ClipboardList,
  HeartPulse,
  Refrigerator,
  ShoppingCart,
  UtensilsCrossed,
} from 'lucide-react';
import type { AppTab } from '../types';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  inventoryCount: number;
  shoppingRemainingCount: number;
  todayMealCount: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  inventoryCount,
  shoppingRemainingCount,
  todayMealCount,
}: BottomNavProps) {
  const items: {
    id: AppTab;
    label: string;
    icon: typeof UtensilsCrossed;
    badge?: number;
  }[] = [
    { id: 'meals', label: '献立', icon: UtensilsCrossed },
    {
      id: 'shopping',
      label: '買い物・チラシ',
      icon: ShoppingCart,
      badge: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined,
    },
    { id: 'inventory', label: '在庫', icon: Refrigerator, badge: inventoryCount },
    {
      id: 'logs',
      label: '記録・ログ',
      icon: ClipboardList,
      badge: todayMealCount > 0 ? todayMealCount : undefined,
    },
    { id: 'profile', label: '設定', icon: HeartPulse },
  ];

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="メインナビゲーション"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition ${
                isActive
                  ? 'text-teal-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`relative flex h-7 w-11 items-center justify-center rounded-full transition ${
                  isActive ? 'bg-teal-100/90' : ''
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'}`} />
                {typeof item.badge === 'number' && (
                  <span
                    className={`absolute -top-1 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              <span
                className={`truncate text-[10px] leading-none ${
                  isActive ? 'font-bold text-teal-800' : 'font-medium text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
