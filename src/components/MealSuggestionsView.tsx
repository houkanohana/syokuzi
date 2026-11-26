import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Lightbulb,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Users,
  Utensils,
  Video,
  Youtube,
} from 'lucide-react';
import {
  familyMemberToNutritionInput,
  getChemoGuidanceMeta,
  getConditionMeta,
  profileToNutritionInput,
} from '../data/conditions';
import {
  FOOD_COMPOSITION_SOURCE_LABEL,
  FOOD_COMPOSITION_SOURCE_URL,
} from '../data/foodComposition';
import { BASIC_COOKING_GUIDES } from '../data/recipes';
import {
  calculateDailyTargets,
  compareMealWithTarget,
  formatDailyTarget,
} from '../nutrition/calculator';
import { NUTRIENT_META } from '../nutrition/referenceData';
import type {
  CustomVideoMap,
  InventoryItem,
  MealPeriod,
  SuggestedMeal,
  UserProfile,
} from '../types';
import { buildYouTubeSearchUrl, extractYouTubeVideoId } from '../utils/mealEngine';

interface MealSuggestionsViewProps {
  profile: UserProfile;
  inventory: InventoryItem[];
  suggestedMeals: SuggestedMeal[];
  hasAiMeals: boolean;
  aiLoading: boolean;
  aiError: string | null;
  customVideos: CustomVideoMap;
  stepProgress: Record<string, boolean[]>;
  loggedMealIdsToday: Set<string>;
  onShuffleRuleMeals: () => void;
  onGenerateWithGemini: () => void;
  onLogMealEaten: (meal: SuggestedMeal) => void;
  onChangeStepProgress: (recipeId: string, nextSteps: boolean[]) => void;
  onSaveCustomVideo: (key: string, url: string, title?: string) => void;
  onDeleteCustomVideo: (key: string) => void;
  onOpenProfile: () => void;
  onOpenInventory: () => void;
  onOpenShopping: () => void;
  onOpenLogs: () => void;
}

const MEAL_PERIOD_LABELS: Record<MealPeriod, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
};

export function MealSuggestionsView({
  profile,
  inventory,
  suggestedMeals,
  hasAiMeals,
  aiLoading,
  aiError,
  customVideos,
  stepProgress,
  loggedMealIdsToday,
  onShuffleRuleMeals,
  onGenerateWithGemini,
  onLogMealEaten,
  onChangeStepProgress,
  onSaveCustomVideo,
  onDeleteCustomVideo,
  onOpenProfile,
  onOpenInventory,
  onOpenShopping,
  onOpenLogs,
}: MealSuggestionsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<MealPeriod>('dinner');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [mappingOpen, setMappingOpen] = useState<Record<string, boolean>>({});
  const [videoPanelOpen, setVideoPanelOpen] = useState<Record<string, boolean>>({});
  const [videoUrlDrafts, setVideoUrlDrafts] = useState<Record<string, string>>({});
  const [videoErrorMap, setVideoErrorMap] = useState<Record<string, string>>({});
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [justLoggedId, setJustLoggedId] = useState<string | null>(null);

  const dailyResult = useMemo(
    () => calculateDailyTargets(profileToNutritionInput(profile)),
    [profile]
  );

  const familyResults = useMemo(
    () =>
      profile.familyMembers.map((member) => ({
        member,
        result: calculateDailyTargets(familyMemberToNutritionInput(member)),
      })),
    [profile.familyMembers]
  );

  const mealRatioPercent = profile.mealRatios[selectedPeriod];

  useEffect(() => {
    if (suggestedMeals.length > 0) {
      setExpandedIds({ [suggestedMeals[0].id]: true });
    }
  }, [suggestedMeals]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVideoPanel = (id: string) => {
    setVideoPanelOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!videoUrlDrafts[id] && customVideos[id]?.url) {
      setVideoUrlDrafts((prev) => ({ ...prev, [id]: customVideos[id].url }));
    }
  };

  const handleToggleStep = (meal: SuggestedMeal, stepIdx: number) => {
    const current =
      stepProgress[meal.id]?.length === meal.steps.length
        ? [...stepProgress[meal.id]]
        : meal.steps.map(() => false);
    current[stepIdx] = !current[stepIdx];
    onChangeStepProgress(meal.id, current);
  };

  const handleResetSteps = (meal: SuggestedMeal) => {
    onChangeStepProgress(
      meal.id,
      meal.steps.map(() => false)
    );
  };

  const handleSaveVideoUrl = (key: string, defaultTitle: string) => {
    const draft = (videoUrlDrafts[key] ?? '').trim();
    if (!draft) {
      onDeleteCustomVideo(key);
      setVideoErrorMap((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    const videoId = extractYouTubeVideoId(draft);
    if (!videoId) {
      setVideoErrorMap((prev) => ({
        ...prev,
        [key]: '有効なYouTube URL（通常・短縮・限定公開URL等）を入力してください。',
      }));
      return;
    }
    setVideoErrorMap((prev) => ({ ...prev, [key]: '' }));
    onSaveCustomVideo(key, draft, defaultTitle);
  };

  const handleMarkEaten = (meal: SuggestedMeal) => {
    onLogMealEaten(meal);
    setJustLoggedId(meal.id);
    window.setTimeout(() => {
      setJustLoggedId((prev) => (prev === meal.id ? null : prev));
    }, 3000);
  };

  const activeConditionMetas = profile.selectedConditions.map((id) =>
    getConditionMeta(id)
  );
  const activeChemoMetas = profile.selectedConditions.includes('chemo_side_effects')
    ? profile.chemoSymptoms
        .map((id) => getChemoGuidanceMeta(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
    : [];

  return (
    <div className="space-y-4 pb-6">
      {/* 現在の適用条件＆1日目安サマリー */}
      <section className="rounded-3xl border border-teal-200/70 bg-gradient-to-br from-teal-700 to-teal-800 p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-teal-100">
              {profile.age ?? '-'}歳・{profile.sex === 'male' ? '男性' : '女性'}（
              {profile.servings}人分・在庫{inventory.length}品）
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {activeConditionMetas.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-white/18 px-2.5 py-0.5 text-xs font-bold text-white"
                >
                  {c.shortName}
                </span>
              ))}
              {activeChemoMetas.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-purple-300/25 px-2.5 py-0.5 text-xs font-semibold text-purple-50"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            設定
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-1.5 rounded-2xl bg-black/15 p-2.5 text-xs sm:grid-cols-3">
          <div>
            <p className="text-[10px] text-teal-100">1日エネルギー目安</p>
            <p className="font-bold leading-snug">
              {formatDailyTarget(dailyResult.targets.energy, 'kcal')}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-teal-100">1日食塩相当量</p>
            <p className="font-bold leading-snug">
              {formatDailyTarget(dailyResult.targets.salt, 'g')}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-teal-100">1日たんぱく質</p>
            <p className="font-bold leading-snug">
              {formatDailyTarget(dailyResult.targets.protein, 'g')}
            </p>
          </div>
        </div>

        {/* 1食比較の食事区分切替（朝30%・昼35%・夕35%） */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-teal-950/35 p-1.5">
          <span className="pl-2 text-[11px] font-semibold text-teal-100">
            1食比較の配分：
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['breakfast', 'lunch', 'dinner'] as MealPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                  selectedPeriod === p
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'bg-transparent text-white/90 hover:bg-white/15'
                }`}
              >
                {MEAL_PERIOD_LABELS[p]} {profile.mealRatios[p]}%
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 症状別の食事の工夫（GANJOHO・合併時注意つき） */}
      {dailyResult.symptomTips.length > 0 && (
        <section className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5 text-xs text-purple-950">
          <p className="font-bold text-purple-900">
            選択中の症状に合わせた食事の工夫（出典：GANJOHO）
          </p>
          <ul className="mt-1.5 space-y-1 leading-relaxed">
            {dailyResult.symptomTips.map((item, idx) => (
              <li key={idx}>
                <span className="mr-1.5 rounded bg-purple-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.label}
                </span>
                {item.tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 提案モード・再提案アクションバー */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            profile.generationMode === 'gemini' && hasAiMeals
              ? 'bg-indigo-50 text-indigo-700'
              : 'bg-teal-50 text-teal-700'
          }`}
        >
          {profile.generationMode === 'gemini' ? (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Gemini AIモード（八訂計算）
            </>
          ) : (
            <>
              <ChefHat className="h-3.5 w-3.5" />
              ルールベース提案（八訂計算）
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          {profile.generationMode === 'gemini' ? (
            <button
              type="button"
              disabled={aiLoading}
              onClick={onGenerateWithGemini}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {hasAiMeals ? 'AIで再生成' : 'AIで3パターン生成'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onShuffleRuleMeals}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              別の3パターンを見る
            </button>
          )}
        </div>
      </div>

      {profile.generationMode === 'gemini' && !profile.geminiApiKey.trim() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">Gemini APIキーが未設定のため、ルールベース候補を表示しています</p>
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-2 rounded-lg bg-amber-700 px-2.5 py-1 font-bold text-white"
              >
                設定画面でAPIキーを入力
              </button>
            </div>
          </div>
        </div>
      )}

      {aiError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold">AI生成に失敗しました（ルールベース候補を表示中）</p>
              <p className="mt-1 leading-relaxed">{aiError}</p>
            </div>
          </div>
        </div>
      )}

      {inventory.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700">
          自宅の在庫が0品です。
          <button
            type="button"
            onClick={onOpenInventory}
            className="ml-1 font-bold text-teal-700 underline"
          >
            在庫管理画面
          </button>
          から食材を登録すると、家にある食材を活かした献立が優先提案されます。
        </div>
      )}

      {/* 献立3パターンカード */}
      <div className="space-y-4">
        {suggestedMeals.map((meal, index) => {
          const isExpanded = Boolean(expandedIds[meal.id]);
          const isMappingExpanded = Boolean(mappingOpen[meal.id]);
          const youtubeUrl = buildYouTubeSearchUrl(meal.title);
          const n = meal.nutritionPerServing;
          const ex = meal.exactNutrition;
          const fmtVal = (val: number | null | undefined, unit: string) =>
            val == null ? 'データなし' : `${val}${unit}`;

          // 1食の目安との比較（選択中の食事区分配分で厳密判定・要確認時は「計算が不確か」）
          const cmpOpt = { isUncertain: meal.needsVerification };
          const cmpEnergy = compareMealWithTarget(
            'energy',
            dailyResult.targets.energy,
            ex ? ex.energy : n.caloriesKcal,
            mealRatioPercent,
            'kcal',
            cmpOpt
          );
          const cmpSalt = compareMealWithTarget(
            'salt',
            dailyResult.targets.salt,
            ex ? ex.salt : n.saltG,
            mealRatioPercent,
            'g',
            cmpOpt
          );
          const cmpProtein = compareMealWithTarget(
            'protein',
            dailyResult.targets.protein,
            ex ? ex.protein : n.proteinG,
            mealRatioPercent,
            'g',
            cmpOpt
          );
          const cmpPotassium = compareMealWithTarget(
            'potassium',
            dailyResult.targets.potassium,
            ex ? ex.potassium : n.potassiumMg,
            mealRatioPercent,
            'mg',
            cmpOpt
          );

          const checks =
            stepProgress[meal.id]?.length === meal.steps.length
              ? stepProgress[meal.id]
              : meal.steps.map(() => false);
          const doneStepCount = checks.filter(Boolean).length;

          const savedVideo = customVideos[meal.id];
          const savedVideoId = savedVideo ? extractYouTubeVideoId(savedVideo.url) : null;
          const isLoggedToday = loggedMealIdsToday.has(meal.id);

          return (
            <article
              key={meal.id}
              className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs"
            >
              {/* カードヘッダー */}
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-teal-50/40 px-4 pt-4 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="rounded-full bg-teal-100/80 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                      {meal.category}
                    </span>
                    {meal.flags?.soft && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                        やわらか印
                      </span>
                    )}
                    {meal.needsVerification && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300">
                        要確認（計算が不確か）
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    約{meal.cookTimeMin}分
                  </span>
                </div>

                <h3 className="mt-2 text-base font-bold leading-snug text-slate-900">
                  {meal.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {meal.subtitle}
                </p>

                <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200/80">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                  <span>{meal.matchReason}</span>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {/* 1人あたりの栄養価（八訂計算）＆1食目安比較 */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      1人分の栄養価（{MEAL_PERIOD_LABELS[selectedPeriod]} {mealRatioPercent}%と比較）
                    </span>
                    <a
                      href={FOOD_COMPOSITION_SOURCE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-teal-700 underline"
                    >
                      八訂成分表計算
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2.5 text-center ring-1 ring-slate-200/70">
                    {[
                      { label: 'エネルギー', value: fmtVal(ex ? ex.energy : n.caloriesKcal, 'kcal'), cmp: cmpEnergy },
                      { label: '食塩相当量', value: fmtVal(ex ? ex.salt : n.saltG, 'g'), cmp: cmpSalt },
                      { label: 'たんぱく質', value: fmtVal(ex ? ex.protein : n.proteinG, 'g'), cmp: cmpProtein },
                    ].map((col) => (
                      <div key={col.label} className="space-y-1">
                        <p className="text-[10px] font-medium text-slate-500">{col.label}</p>
                        <p className="text-sm font-bold text-slate-900">{col.value}</p>
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            col.cmp.status === 'high'
                              ? 'bg-rose-100 text-rose-700'
                              : col.cmp.status === 'uncertain'
                                ? 'bg-amber-100 text-amber-900'
                                : col.cmp.status === 'uncompared'
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {col.cmp.status === 'high'
                            ? '多め'
                            : col.cmp.status === 'uncertain'
                              ? '計算が不確か'
                              : col.cmp.status === 'uncompared'
                                ? '比較対象外'
                                : '目安内'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 1食比較の詳細メッセージ（needInstruction時・要確認時を明示） */}
                  <div className="mt-1.5 space-y-0.5 rounded-xl bg-slate-50/80 px-2.5 py-2 text-[10px] text-slate-600">
                    <p>
                      食塩（{MEAL_PERIOD_LABELS[selectedPeriod]}目安：{cmpSalt.mealLimitText}）→{' '}
                      <strong
                        className={
                          cmpSalt.status === 'high'
                            ? 'text-rose-700'
                            : cmpSalt.status === 'uncertain'
                              ? 'text-amber-800'
                              : 'text-slate-800'
                        }
                      >
                        {cmpSalt.message}
                      </strong>
                    </p>
                    <p>
                      カロリー（{MEAL_PERIOD_LABELS[selectedPeriod]}目安：{cmpEnergy.mealLimitText}）→{' '}
                      <strong
                        className={
                          cmpEnergy.status === 'high'
                            ? 'text-rose-700'
                            : cmpEnergy.status === 'uncertain'
                              ? 'text-amber-800'
                              : 'text-slate-800'
                        }
                      >
                        {cmpEnergy.message}
                      </strong>
                    </p>
                    {profile.selectedConditions.includes('kidney_disease') && (
                      <p>
                        カリウム {fmtVal(ex ? ex.potassium : n.potassiumMg, 'mg')}（目安：
                        {cmpPotassium.mealLimitText}）→{' '}
                        <strong
                          className={
                            cmpPotassium.status === 'high'
                              ? 'text-rose-700'
                              : cmpPotassium.status === 'uncertain'
                                ? 'text-amber-800'
                                : 'text-slate-800'
                          }
                        >
                          {cmpPotassium.message}
                        </strong>
                      </p>
                    )}
                    <p className="pt-0.5 text-[10px] text-slate-500">
                      脂質 {fmtVal(ex ? ex.fat : n.fatG, 'g')} ／ 炭水化物{' '}
                      {fmtVal(ex ? ex.carb : n.carbsG, 'g')} ／ 食物繊維{' '}
                      {fmtVal(ex ? ex.fiber : n.fiberG, 'g')} ／ カリウム{' '}
                      {fmtVal(ex ? ex.potassium : n.potassiumMg, 'mg')} ／ リン{' '}
                      {fmtVal(ex ? ex.phosphorus : n.phosphorusMg, 'mg')} ／ 水分{' '}
                      {fmtVal(ex ? ex.water : n.fluidMl, 'mL')}
                    </p>
                    {meal.prepNotices.length > 0 && (
                      <div className="mt-1 space-y-0.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1 text-[10px] font-semibold text-amber-950">
                        {meal.prepNotices.map((notice, idx) => (
                          <p key={idx}>※ {notice}</p>
                        ))}
                      </div>
                    )}
                    {meal.needsVerification && (
                      <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-950">
                        <p className="font-bold">⚠ 要確認（計算が不確か）</p>
                        <ul className="mt-0.5 space-y-0.5 leading-snug">
                          {meal.verificationReasons.map((reason, idx) => (
                            <li key={idx}>・{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 成分表の照合内訳（どの食品で計算したか） */}
                    {meal.matchedFoodMappings.length > 0 && (
                      <div className="mt-1.5 border-t border-slate-200/70 pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setMappingOpen((prev) => ({
                              ...prev,
                              [meal.id]: !prev[meal.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 hover:underline"
                        >
                          {isMappingExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          計算に使った成分表の食品を見る（{meal.matchedFoodMappings.length}品目）
                        </button>
                        {isMappingExpanded && (
                          <ul className="mt-1 space-y-0.5 rounded-lg bg-white p-2 text-[10px] text-slate-600 ring-1 ring-slate-200/70">
                            {meal.matchedFoodMappings.map((m, idx) => (
                              <li key={`${meal.id}-map-${idx}`} className="leading-snug">
                                <span className="font-semibold text-slate-800">
                                  {m.inputName}（{m.grams}g）
                                </span>{' '}
                                →{' '}
                                <span className="text-teal-800">
                                  [{m.foodId}] {m.official}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ご家族別の1食比較（登録時） */}
                  {familyResults.length > 0 && (
                    <div className="mt-2 rounded-xl border border-teal-200/70 bg-teal-50/40 p-2.5">
                      <p className="flex items-center gap-1 text-[10px] font-bold text-teal-900">
                        <Users className="h-3 w-3" />
                        ご家族別の1食比較（{MEAL_PERIOD_LABELS[selectedPeriod]} {mealRatioPercent}%）
                      </p>
                      <ul className="mt-1 space-y-1 text-[10px] text-slate-700">
                        {familyResults.map(({ member, result }) => {
                          const fSalt = compareMealWithTarget(
                            'salt',
                            result.targets.salt,
                            ex ? ex.salt : n.saltG,
                            mealRatioPercent,
                            'g',
                            cmpOpt
                          );
                          const fEnergy = compareMealWithTarget(
                            'energy',
                            result.targets.energy,
                            ex ? ex.energy : n.caloriesKcal,
                            mealRatioPercent,
                            'kcal',
                            cmpOpt
                          );
                          return (
                            <li
                              key={member.id}
                              className="flex flex-wrap items-center justify-between gap-1"
                            >
                              <span className="font-bold">{member.name}</span>
                              <span>
                                食塩：
                                <strong
                                  className={
                                    fSalt.status === 'high'
                                      ? 'text-rose-700'
                                      : fSalt.status === 'uncertain'
                                        ? 'text-amber-800'
                                        : 'text-emerald-700'
                                  }
                                >
                                  {fSalt.message}
                                </strong>
                                ／ カロリー：
                                <strong
                                  className={
                                    fEnergy.status === 'high'
                                      ? 'text-rose-700'
                                      : fEnergy.status === 'uncertain'
                                        ? 'text-amber-800'
                                        : 'text-emerald-700'
                                  }
                                >
                                  {fEnergy.message}
                                </strong>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* ワンタップ「食べた」食事記録ボタン */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkEaten(meal)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold shadow-xs transition ${
                      justLoggedId === meal.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-teal-700 text-white hover:bg-teal-800'
                    }`}
                  >
                    <Utensils className="h-4 w-4" />
                    {justLoggedId === meal.id
                      ? '本日の食事記録に登録しました ✓'
                      : isLoggedToday
                        ? 'もう一度「食べた」を記録する'
                        : '食べた！（1人分を食事記録へ）'}
                  </button>
                  {isLoggedToday && (
                    <button
                      type="button"
                      onClick={onOpenLogs}
                      className="shrink-0 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-bold text-teal-800"
                    >
                      記録を見る
                    </button>
                  )}
                </div>

                {/* 家にある食材 / 足りない食材 */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      家にある食材（{meal.servings}人分）
                    </p>
                    {meal.availableIngredients.length === 0 ? (
                      <p className="mt-1.5 text-xs text-slate-500">一致する在庫なし</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {meal.availableIngredients.map((ing) => (
                          <li
                            key={`${meal.id}-avail-${ing.name}`}
                            className="flex items-baseline justify-between gap-2 text-xs text-slate-700"
                          >
                            <span className="font-medium">{ing.name}</span>
                            <span className="shrink-0 font-semibold text-emerald-800">
                              {ing.amount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/55 p-3">
                    <div className="flex items-center justify-between gap-1">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <ShoppingBasket className="h-4 w-4 text-amber-600" />
                        足りない食材
                      </p>
                      {meal.missingIngredients.length > 0 && (
                        <button
                          type="button"
                          onClick={onOpenShopping}
                          className="text-[10px] font-bold text-amber-800 underline"
                        >
                          買い物へ
                        </button>
                      )}
                    </div>
                    {meal.missingIngredients.length === 0 ? (
                      <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                        買い足し不要！今ある在庫で作れます
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {meal.missingIngredients.map((ing) => (
                          <li
                            key={`${meal.id}-miss-${ing.name}`}
                            className="flex items-baseline justify-between gap-2 text-xs text-amber-950"
                          >
                            <span className="font-medium">{ing.name}</span>
                            <span className="shrink-0 font-semibold text-amber-800">
                              {ing.amount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* チェック式調理手順＆疾患別のコツ */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => toggleExpand(meal.id)}
                    className="flex w-full items-center justify-between px-3.5 py-3 text-left"
                    aria-expanded={isExpanded}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <ChefHat className="h-4 w-4 text-teal-700" />
                      調理手順（{doneStepCount}/{meal.steps.length} 完了）とコツ
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-slate-200/70 px-3.5 pt-3 pb-3.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>※各ステップをタップして完了チェックできます</span>
                        {doneStepCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleResetSteps(meal)}
                            className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" />
                            リセット
                          </button>
                        )}
                      </div>

                      <ol className="space-y-2">
                        {meal.steps.map((step, idx) => {
                          const done = Boolean(checks[idx]);
                          return (
                            <li key={`${meal.id}-step-${idx}`}>
                              <button
                                type="button"
                                onClick={() => handleToggleStep(meal, idx)}
                                className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs leading-relaxed transition ${
                                  done
                                    ? 'border-teal-200 bg-teal-50/80 text-slate-400 line-through'
                                    : 'border-slate-200/70 bg-white text-slate-700 hover:border-teal-300'
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                                    done
                                      ? 'border-teal-700 bg-teal-700 text-white'
                                      : 'border-slate-300 bg-slate-50 text-teal-800'
                                  }`}
                                >
                                  {done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                                </span>
                                <span>{step}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>

                      <div className="rounded-xl border border-teal-200/80 bg-teal-50/75 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                          <Lightbulb className="h-4 w-4 text-teal-700" />
                          体調に合わせた調理・食べやすさの工夫
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {meal.careTips.map((tip, idx) => (
                            <li
                              key={`${meal.id}-tip-${idx}`}
                              className="text-xs leading-relaxed text-teal-950"
                            >
                              <span className="mr-1.5 inline-block rounded-md bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {tip.label}
                              </span>
                              <span>{tip.tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* YouTube動画検索＋アプリ内埋め込み */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Youtube className="h-4 w-4 text-rose-600" />
                      <span>YouTubeで作り方を動画で見る</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </a>

                    <button
                      type="button"
                      onClick={() => toggleVideoPanel(meal.id)}
                      className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-teal-300"
                    >
                      <Video className="h-4 w-4 text-teal-700" />
                      {savedVideoId ? '登録済みの埋め込み動画を再生' : '限定公開・参考動画URLを登録'}
                    </button>
                  </div>

                  {(videoPanelOpen[meal.id] || savedVideoId) && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      {savedVideoId && (
                        <div className="mb-2.5 overflow-hidden rounded-xl bg-black shadow-xs">
                          <div className="relative aspect-video w-full">
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${savedVideoId}`}
                              title={`${meal.title} 参考動画`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="absolute inset-0 h-full w-full border-0"
                            />
                          </div>
                        </div>
                      )}

                      {videoPanelOpen[meal.id] && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-slate-600">
                            YouTube動画URL（限定公開URLも対応）
                          </p>
                          <div className="flex gap-1.5">
                            <input
                              type="url"
                              value={videoUrlDrafts[meal.id] ?? savedVideo?.url ?? ''}
                              onChange={(e) =>
                                setVideoUrlDrafts((prev) => ({
                                  ...prev,
                                  [meal.id]: e.target.value,
                                }))
                              }
                              placeholder="https://www.youtube.com/watch?v=... または https://youtu.be/..."
                              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveVideoUrl(meal.id, meal.title)}
                              className="shrink-0 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white"
                            >
                              保存
                            </button>
                          </div>
                          {videoErrorMap[meal.id] && (
                            <p className="text-[11px] font-semibold text-rose-600">
                              {videoErrorMap[meal.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* 基本調理の動画ガイド */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setGuidesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                基本調理の動画ガイド（減塩だし・やわらか調理）
              </h2>
              <p className="text-[11px] text-slate-500">
                療養食の基本テクニックを動画検索・限定公開URL埋め込み可能
              </p>
            </div>
          </div>
          {guidesOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {guidesOpen && (
          <div className="space-y-3 border-t border-slate-100 p-4">
            {BASIC_COOKING_GUIDES.map((guide) => {
              const saved = customVideos[guide.id];
              const vid = saved ? extractYouTubeVideoId(saved.url) : null;
              return (
                <div
                  key={guide.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <p className="text-xs font-bold text-slate-900">{guide.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{guide.description}</p>

                  {vid && (
                    <div className="mt-2 overflow-hidden rounded-xl bg-black">
                      <div className="relative aspect-video w-full">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${vid}`}
                          title={guide.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 h-full w-full border-0"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={buildYouTubeSearchUrl(guide.youtubeQuery)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      YouTube検索
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleVideoPanel(guide.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
                    >
                      <Video className="h-3.5 w-3.5 text-teal-700" />
                      {vid ? '埋め込みURLを変更' : '動画URLを埋め込む'}
                    </button>
                  </div>

                  {videoPanelOpen[guide.id] && (
                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="url"
                        value={videoUrlDrafts[guide.id] ?? saved?.url ?? ''}
                        onChange={(e) =>
                          setVideoUrlDrafts((prev) => ({
                            ...prev,
                            [guide.id]: e.target.value,
                          }))
                        }
                        placeholder="YouTube URL（限定公開OK）"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveVideoUrl(guide.id, guide.title)}
                        className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        出典：{FOOD_COMPOSITION_SOURCE_LABEL}（
        <a
          href={FOOD_COMPOSITION_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 underline"
        >
          文部科学省
        </a>
        ）／ {NUTRIENT_META.energy.label}等の目安値は厚生労働省DRI2025・各学会ガイドラインに基づく参考値です。
      </p>
    </div>
  );
}
