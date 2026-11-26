import { useEffect, useMemo, useState } from 'react';
import { ALargeSmall, HeartHandshake, RefreshCw, ShieldCheck } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { DisclaimerModal } from './components/DisclaimerModal';
import { InventoryView } from './components/InventoryView';
import { LogsView } from './components/LogsView';
import { MealSuggestionsView } from './components/MealSuggestionsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { ShoppingFlyerView } from './components/ShoppingFlyerView';
import type {
  AppTab,
  CustomVideoMap,
  FlyerEntry,
  InventoryItem,
  LegalTab,
  MealLogEntry,
  MealSlot,
  ShoppingItem,
  SuggestedMeal,
  UserProfile,
  VitalLogEntry,
} from './types';
import { generateGeminiMealSuggestions } from './utils/geminiService';
import { generateRuleBasedSuggestions } from './utils/mealEngine';
import {
  buildSyncedShoppingList,
  matchShoppingItemsWithFlyers,
} from './utils/shoppingEngine';
import {
  createBackupPayload,
  getTodayDateString,
  loadCustomVideos,
  loadFlyers,
  loadInventory,
  loadMealLogs,
  loadShoppingItems,
  loadStepProgress,
  loadUserProfile,
  loadVitalLogs,
  parseBackupJson,
  saveCustomVideos,
  saveFlyers,
  saveInventory,
  saveMealLogs,
  saveShoppingItems,
  saveStepProgress,
  saveUserProfile,
  saveVitalLogs,
} from './utils/storage';

const TAB_TITLES: Record<AppTab, { title: string; subtitle: string }> = {
  meals: {
    title: '今日の献立提案',
    subtitle: '在庫と疾患・症状モードからおすすめ3パターンを提案',
  },
  shopping: {
    title: '買い物・チラシ連携',
    subtitle: '特売チラシと不足食材を照合してお店別に整理',
  },
  inventory: {
    title: '自宅の在庫管理',
    subtitle: '冷蔵庫・冷凍庫・常温の食材をかんたん管理',
  },
  logs: {
    title: '食事記録・体調ログ',
    subtitle: '1日の栄養達成度と体重・血圧・水分・むくみを記録',
  },
  profile: {
    title: '体調・目標設定',
    subtitle: '疾患合併・制限値ロック・AI設定・バックアップ管理',
  },
};

function inferCurrentMealSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 22) return 'dinner';
  return 'snack';
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadInventory());
  const [flyers, setFlyers] = useState<FlyerEntry[]>(() => loadFlyers());
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() =>
    loadShoppingItems()
  );
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>(() => loadMealLogs());
  const [vitalLogs, setVitalLogs] = useState<VitalLogEntry[]>(() => loadVitalLogs());
  const [customVideos, setCustomVideos] = useState<CustomVideoMap>(() =>
    loadCustomVideos()
  );
  const [stepProgress, setStepProgress] = useState<Record<string, boolean[]>>(() =>
    loadStepProgress()
  );

  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    loadUserProfile().disclaimerAccepted ? 'meals' : 'profile'
  );
  const [legalModalState, setLegalModalState] = useState<{
    open: boolean;
    tab: LegalTab;
  }>({ open: false, tab: 'disclaimer' });
  const [pwaUpdatedBanner, setPwaUpdatedBanner] = useState(false);

  // Service Worker が新しい版に切り替わった通知を受信
  useEffect(() => {
    const handlePwaUpdated = () => setPwaUpdatedBanner(true);
    window.addEventListener('app:pwa-updated', handlePwaUpdated);
    return () => window.removeEventListener('app:pwa-updated', handlePwaUpdated);
  }, []);

  // 献立提案状態（ルールベース＆Gemini AI共有）
  const [variationOffset, setVariationOffset] = useState(0);
  const [aiMeals, setAiMeals] = useState<SuggestedMeal[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const ruleMeals = useMemo(
    () => generateRuleBasedSuggestions(profile, inventory, variationOffset),
    [profile, inventory, variationOffset]
  );

  const suggestedMeals =
    profile.generationMode === 'gemini' && aiMeals && aiMeals.length > 0
      ? aiMeals
      : ruleMeals;

  // 文字サイズクラスの反映（標準 / 大きめ）
  useEffect(() => {
    const root = document.documentElement;
    if (profile.fontSize === 'large') {
      root.classList.add('font-size-large');
    } else {
      root.classList.remove('font-size-large');
    }
  }, [profile.fontSize]);

  // localStorage 永続化
  useEffect(() => saveUserProfile(profile), [profile]);
  useEffect(() => saveInventory(inventory), [inventory]);
  useEffect(() => saveFlyers(flyers), [flyers]);
  useEffect(() => saveShoppingItems(shoppingItems), [shoppingItems]);
  useEffect(() => saveMealLogs(mealLogs), [mealLogs]);
  useEffect(() => saveVitalLogs(vitalLogs), [vitalLogs]);
  useEffect(() => saveCustomVideos(customVideos), [customVideos]);
  useEffect(() => saveStepProgress(stepProgress), [stepProgress]);

  // 献立・チラシが更新されたら買い物リストの不足食材と特売照合を自動同期
  useEffect(() => {
    setShoppingItems((prev) => buildSyncedShoppingList(suggestedMeals, prev, flyers));
  }, [suggestedMeals, flyers]);

  const handleChangeShoppingItems = (next: ShoppingItem[]) => {
    setShoppingItems(matchShoppingItemsWithFlyers(next, flyers));
  };

  const handleResyncShoppingFromMeals = () => {
    setShoppingItems((prev) => buildSyncedShoppingList(suggestedMeals, prev, flyers));
  };

  const handleMoveCheckedToInventory = () => {
    const checked = shoppingItems.filter((i) => i.checked);
    if (checked.length === 0) return;

    const now = new Date().toISOString();
    const newInvItems: InventoryItem[] = checked.map((item, idx) => ({
      id: `bought-${Date.now()}-${idx}`,
      name: item.name,
      location: 'fridge',
      quantityText: item.amount,
      stockLevel: 'plenty',
      updatedAt: now,
    }));

    setInventory((prev) => [...newInvItems, ...prev]);
    setShoppingItems((prev) => prev.filter((i) => !i.checked));
  };

  const handleGenerateWithGemini = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const results = await generateGeminiMealSuggestions(profile, inventory);
      setAiMeals(results);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'AIによる献立生成中にエラーが発生しました。'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleLogMealEaten = (meal: SuggestedMeal) => {
    const now = new Date();
    const entry: MealLogEntry = {
      id: `meal-log-${Date.now()}`,
      date: getTodayDateString(),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`,
      slot: inferCurrentMealSlot(),
      title: meal.title,
      portionRatio: 1,
      nutrition: meal.nutritionPerServing,
      recipeId: meal.id,
    };
    setMealLogs((prev) => [entry, ...prev]);
  };

  const handleChangeStepProgress = (recipeId: string, nextSteps: boolean[]) => {
    setStepProgress((prev) => ({ ...prev, [recipeId]: nextSteps }));
  };

  const handleSaveCustomVideo = (key: string, url: string, title?: string) => {
    setCustomVideos((prev) => ({ ...prev, [key]: { url, title } }));
  };

  const handleDeleteCustomVideo = (key: string) => {
    setCustomVideos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleExportBackup = () => {
    const payload = createBackupPayload({
      profile,
      inventory,
      flyers,
      shoppingItems,
      mealLogs,
      vitalLogs,
      customVideos,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ouchi-kondate-care-backup-${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (rawJsonText: string) => {
    const data = parseBackupJson(rawJsonText);
    setProfile(data.profile);
    setInventory(data.inventory);
    setFlyers(data.flyers);
    setShoppingItems(data.shoppingItems);
    setMealLogs(data.mealLogs);
    setVitalLogs(data.vitalLogs);
    setCustomVideos(data.customVideos);
  };

  const handleAcceptDisclaimer = () => {
    setProfile((prev) => ({
      ...prev,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date().toISOString(),
    }));
    setActiveTab('profile');
  };

  const handleChangeTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFontSize = () => {
    setProfile((prev) => ({
      ...prev,
      fontSize: prev.fontSize === 'large' ? 'normal' : 'large',
    }));
  };

  const today = getTodayDateString();
  const todayMealLogs = mealLogs.filter((m) => m.date === today);
  const loggedMealIdsToday = new Set(
    todayMealLogs.map((m) => m.recipeId).filter((id): id is string => Boolean(id))
  );
  const shoppingRemainingCount = shoppingItems.filter((i) => !i.checked).length;

  const headerMeta = TAB_TITLES[activeTab];

  return (
    <div className="min-h-dvh bg-[#f2f6f4]">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-[#f7faf8] shadow-xl shadow-slate-900/5">
        {/* 固定トップヘッダー（文字サイズ切替・免責/規約ボタン配置） */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-xs">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold tracking-wide text-teal-700">
                    おうち献立ケア
                  </span>
                </div>
                <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                  {headerMeta.title}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleFontSize}
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                  profile.fontSize === 'large'
                    ? 'border-teal-600 bg-teal-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                }`}
                title="文字サイズを切り替え（標準・大きめ）"
              >
                <ALargeSmall className="h-3.5 w-3.5" />
                {profile.fontSize === 'large' ? '文字:大' : '文字:標準'}
              </button>

              <button
                type="button"
                onClick={() => setLegalModalState({ open: true, tab: 'disclaimer' })}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                title="医療免責事項・利用規約・プライバシーポリシー"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
                規約
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{headerMeta.subtitle}</p>
        </header>

        {/* PWA 新バージョン反映バナー */}
        {pwaUpdatedBanner && (
          <div className="border-b border-teal-200 bg-teal-50 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs text-teal-950">
              <span className="font-bold">
                新しいバージョンが利用できます
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-800"
                >
                  <RefreshCw className="h-3 w-3" />
                  再読み込み
                </button>
                <button
                  type="button"
                  onClick={() => setPwaUpdatedBanner(false)}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                >
                  あとで
                </button>
              </div>
            </div>
          </div>
        )}

        {/* メインコンテンツ */}
        <main className="flex-1 px-4 pt-4 pb-24">
          {activeTab === 'meals' && (
            <MealSuggestionsView
              profile={profile}
              inventory={inventory}
              suggestedMeals={suggestedMeals}
              hasAiMeals={Boolean(aiMeals && aiMeals.length > 0)}
              aiLoading={aiLoading}
              aiError={aiError}
              customVideos={customVideos}
              stepProgress={stepProgress}
              loggedMealIdsToday={loggedMealIdsToday}
              onShuffleRuleMeals={() => setVariationOffset((v) => v + 1)}
              onGenerateWithGemini={handleGenerateWithGemini}
              onLogMealEaten={handleLogMealEaten}
              onChangeStepProgress={handleChangeStepProgress}
              onSaveCustomVideo={handleSaveCustomVideo}
              onDeleteCustomVideo={handleDeleteCustomVideo}
              onOpenProfile={() => handleChangeTab('profile')}
              onOpenInventory={() => handleChangeTab('inventory')}
              onOpenShopping={() => handleChangeTab('shopping')}
              onOpenLogs={() => handleChangeTab('logs')}
            />
          )}

          {activeTab === 'shopping' && (
            <ShoppingFlyerView
              profile={profile}
              suggestedMeals={suggestedMeals}
              flyers={flyers}
              shoppingItems={shoppingItems}
              onChangeFlyers={setFlyers}
              onChangeShoppingItems={handleChangeShoppingItems}
              onResyncFromMeals={handleResyncShoppingFromMeals}
              onMoveCheckedToInventory={handleMoveCheckedToInventory}
              onOpenProfile={() => handleChangeTab('profile')}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              inventory={inventory}
              onChangeInventory={setInventory}
            />
          )}

          {activeTab === 'logs' && (
            <LogsView
              profile={profile}
              mealLogs={mealLogs}
              vitalLogs={vitalLogs}
              onChangeMealLogs={setMealLogs}
              onChangeVitalLogs={setVitalLogs}
              onGoToMeals={() => handleChangeTab('meals')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileSettingsView
              profile={profile}
              onChangeProfile={setProfile}
              onOpenLegal={(tab) => setLegalModalState({ open: true, tab })}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onGoToMeals={() => handleChangeTab('meals')}
            />
          )}
        </main>

        {/* 下部固定5タブナビゲーション */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          inventoryCount={inventory.length}
          shoppingRemainingCount={shoppingRemainingCount}
          todayMealCount={todayMealLogs.length}
        />
      </div>

      {/* 初回免責同意モーダル */}
      <DisclaimerModal
        isOpen={!profile.disclaimerAccepted}
        onAccept={handleAcceptDisclaimer}
      />

      {/* 免責事項・利用規約・プライバシー確認モーダル */}
      <DisclaimerModal
        isOpen={profile.disclaimerAccepted && legalModalState.open}
        isReviewMode
        initialTab={legalModalState.tab}
        onAccept={() => setLegalModalState((prev) => ({ ...prev, open: false }))}
        onClose={() => setLegalModalState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
