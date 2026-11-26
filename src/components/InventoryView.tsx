import { useState, type FormEvent } from 'react';
import {
  Package,
  Plus,
  Refrigerator,
  RotateCcw,
  Snowflake,
  Trash2,
} from 'lucide-react';
import {
  QUICK_ADD_SUGGESTIONS,
  STOCK_LEVEL_META,
  STORAGE_TABS,
  createSampleInventory,
} from '../data/sampleInventory';
import type { InventoryItem, StockLevel, StorageLocation } from '../types';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onChangeInventory: (next: InventoryItem[]) => void;
}

const TAB_ICONS: Record<StorageLocation, typeof Refrigerator> = {
  fridge: Refrigerator,
  freezer: Snowflake,
  pantry: Package,
};

export function InventoryView({ inventory, onChangeInventory }: InventoryViewProps) {
  const [activeLocation, setActiveLocation] = useState<StorageLocation>('fridge');
  const [nameInput, setNameInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [stockLevel, setStockLevel] = useState<StockLevel>('plenty');

  const itemsInTab = inventory.filter((item) => item.location === activeLocation);

  const countByLocation = (loc: StorageLocation) =>
    inventory.filter((item) => item.location === loc).length;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    const newItem: InventoryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      location: activeLocation,
      quantityText: quantityInput.trim(),
      stockLevel,
      updatedAt: new Date().toISOString(),
    };

    onChangeInventory([newItem, ...inventory]);
    setNameInput('');
    setQuantityInput('');
    setStockLevel('plenty');
  };

  const handleQuickAdd = (ingredientName: string) => {
    const alreadyExists = inventory.some(
      (i) => i.location === activeLocation && i.name === ingredientName
    );
    if (alreadyExists) return;

    const newItem: InventoryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: ingredientName,
      location: activeLocation,
      quantityText: '',
      stockLevel: 'plenty',
      updatedAt: new Date().toISOString(),
    };
    onChangeInventory([newItem, ...inventory]);
  };

  const handleCycleStockLevel = (id: string) => {
    onChangeInventory(
      inventory.map((item) =>
        item.id === id
          ? {
              ...item,
              stockLevel: STOCK_LEVEL_META[item.stockLevel].next,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const handleDelete = (id: string) => {
    onChangeInventory(inventory.filter((item) => item.id !== id));
  };

  const handleResetSamples = () => {
    if (window.confirm('在庫リストを初期のサンプル食材にリセットしますか？')) {
      onChangeInventory(createSampleInventory());
    }
  };

  const existingNamesInTab = new Set(itemsInTab.map((i) => i.name));

  return (
    <div className="space-y-4 pb-6">
      {/* 3つの保管場所タブ */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-200/70 p-1.5">
        {STORAGE_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          const active = activeLocation === tab.id;
          const count = countByLocation(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLocation(tab.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                active
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-slate-300/60 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 食材追加フォーム */}
      <form
        onSubmit={handleAdd}
        className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            {STORAGE_TABS.find((t) => t.id === activeLocation)?.label}に食材を追加
          </h2>
          <span className="text-[11px] text-slate-400">
            {STORAGE_TABS.find((t) => t.id === activeLocation)?.hint}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="食材名（例：キャベツ、鮭）"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
          <input
            type="text"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            placeholder="数量・メモ（任意：例 1/2玉、2切れ）"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-slate-500">残量目安:</span>
            {(['plenty', 'half', 'low'] as StockLevel[]).map((lvl) => {
              const meta = STOCK_LEVEL_META[lvl];
              const active = stockLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setStockLevel(lvl)}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? `${meta.colorClass} ring-2 ring-teal-500/25`
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-teal-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            追加
          </button>
        </div>

        {/* ワンタップ追加チップ */}
        <div className="mt-3.5 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold text-slate-500">よく使う食材をワンタップ追加:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_ADD_SUGGESTIONS[activeLocation].map((suggestion) => {
              const added = existingNamesInTab.has(suggestion);
              return (
                <button
                  key={suggestion}
                  type="button"
                  disabled={added}
                  onClick={() => handleQuickAdd(suggestion)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    added
                      ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                      : 'border-teal-200 bg-teal-50/60 text-teal-800 hover:bg-teal-100'
                  }`}
                >
                  + {suggestion}
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {/* 在庫リスト */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-slate-500">
            登録中の食材（{itemsInTab.length}品）※残量バッジをタップで切替
          </p>
          <button
            type="button"
            onClick={handleResetSamples}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            サンプルに戻す
          </button>
        </div>

        {itemsInTab.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-600">
              この場所にはまだ食材が登録されていません
            </p>
            <p className="mt-1 text-xs text-slate-400">
              上のフォームまたはワンタップ候補から追加してください
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {itemsInTab.map((item) => {
              const stockMeta = STOCK_LEVEL_META[item.stockLevel];
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.quantityText ? item.quantityText : '数量メモなし'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCycleStockLevel(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${stockMeta.colorClass}`}
                      title="タップして残量目安を切り替え"
                    >
                      <span className={`h-2 w-2 rounded-full ${stockMeta.dotClass}`} />
                      {stockMeta.label}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`${item.name}を削除`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
