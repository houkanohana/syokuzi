import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  Calendar,
  ClipboardCheck,
  Droplets,
  HeartPulse,
  Plus,
  Scale,
  Search,
  Stethoscope,
  Trash2,
  Utensils,
} from 'lucide-react';
import { getConditionMeta, profileToNutritionInput } from '../data/conditions';
import {
  FOOD_COMPOSITION_SOURCE_LABEL,
  FOOD_COMPOSITION_SOURCE_URL,
} from '../data/foodComposition';
import {
  calculateDailyTargets,
  formatDailyTarget,
  type DailyTargetValue,
} from '../nutrition/calculator';
import { NUTRIENT_META, type NutrientKey } from '../nutrition/referenceData';
import type {
  DishIngredientInput,
  EdemaLevel,
  MealLogEntry,
  MealSlot,
  UserProfile,
  VitalLogEntry,
} from '../types';
import {
  calculateDishNutrition,
  searchFoodComposition,
} from '../utils/nutritionCalculator';
import { getTodayDateString } from '../utils/storage';

interface LogsViewProps {
  profile: UserProfile;
  mealLogs: MealLogEntry[];
  vitalLogs: VitalLogEntry[];
  onChangeMealLogs: (next: MealLogEntry[]) => void;
  onChangeVitalLogs: (next: VitalLogEntry[]) => void;
  onGoToMeals: () => void;
}

const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};

const EDEMA_META: Record<EdemaLevel, { label: string; color: string }> = {
  none: { label: 'むくみなし', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mild: { label: '軽度あり', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  moderate: { label: 'むくみあり', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function DailyTargetGaugeRow({
  nutrient,
  current,
  target,
}: {
  nutrient: NutrientKey;
  current: number;
  target: DailyTargetValue;
}) {
  const meta = NUTRIENT_META[nutrient];
  const roundedCurrent = Math.round(current * 10) / 10;

  // 数値ゲージを引けるか判定
  let denom: number | null = null;
  let isUpperLimit = false;
  let isOver = false;

  if (target.type === 'instruction') {
    denom = target.value;
    isUpperLimit = target.compare === 'lt' || target.compare === 'le';
    if (target.compare === 'lt') isOver = roundedCurrent >= target.value;
    else if (target.compare === 'le') isOver = roundedCurrent > target.value;
    else if (target.compare === 'about') isOver = roundedCurrent > target.value * 1.1;
  } else if (target.type === 'range') {
    if (target.max != null) {
      denom = target.max;
      isUpperLimit = target.min == null || target.direction === 'limit';
      isOver = target.maxExclusive
        ? roundedCurrent >= target.max
        : roundedCurrent > target.max;
    } else if (target.min != null) {
      denom = target.min;
      isUpperLimit = false;
    }
  }

  const pct = denom && denom > 0 ? Math.min(100, Math.round((roundedCurrent / denom) * 100)) : 0;

  let barColor = 'bg-teal-600';
  if (isUpperLimit && isOver) barColor = 'bg-rose-500';
  else if (isUpperLimit && pct >= 85) barColor = 'bg-amber-500';
  else if (!isUpperLimit && pct >= 100) barColor = 'bg-emerald-600';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
          {meta.label}
          {target.type === 'instruction' && (
            <span className="rounded bg-teal-700 px-1 py-0.5 text-[9px] font-bold text-white">
              病院の指示
            </span>
          )}
        </span>
        <span className="text-right">
          <strong className={isUpperLimit && isOver ? 'text-rose-600' : 'text-slate-900'}>
            {roundedCurrent.toLocaleString()}
            {meta.unit}
          </strong>
          <span className="ml-1 text-[11px] text-slate-500">
            （目安：{formatDailyTarget(target, meta.unit)}）
          </span>
        </span>
      </div>

      {denom != null ? (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-[10px] text-amber-800">
          ※数値目安が未確定のためゲージ比較は行っていません
        </p>
      )}
    </div>
  );
}

export function LogsView({
  profile,
  mealLogs,
  vitalLogs,
  onChangeMealLogs,
  onChangeVitalLogs,
  onGoToMeals,
}: LogsViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [nurseShareMode, setNurseShareMode] = useState(false);

  const dailyResult = useMemo(
    () => calculateDailyTargets(profileToNutritionInput(profile)),
    [profile]
  );

  const existingVital = vitalLogs.find((v) => v.date === selectedDate);
  const [weightInput, setWeightInput] = useState(
    existingVital?.weightKg != null ? String(existingVital.weightKg) : ''
  );
  const [sysInput, setSysInput] = useState(
    existingVital?.systolicBp != null ? String(existingVital.systolicBp) : ''
  );
  const [diaInput, setDiaInput] = useState(
    existingVital?.diastolicBp != null ? String(existingVital.diastolicBp) : ''
  );
  const [fluidInput, setFluidInput] = useState(
    existingVital?.fluidIntakeMl != null ? String(existingVital.fluidIntakeMl) : '0'
  );
  const [edema, setEdema] = useState<EdemaLevel>(existingVital?.edema ?? 'none');
  const [conditionMemo, setConditionMemo] = useState(existingVital?.conditionMemo ?? '');
  const [vitalSavedNotice, setVitalSavedNotice] = useState(false);

  // 手動食事追加フォーム（八訂食材検索自動計算 or 食品表示直接入力）
  const [showManualMeal, setShowManualMeal] = useState(false);
  const [manualInputMode, setManualInputMode] = useState<'food_table' | 'label'>('food_table');
  const [manualSlot, setManualSlot] = useState<MealSlot>('lunch');
  const [manualTitle, setManualTitle] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualSalt, setManualSalt] = useState('');
  const [manualProtein, setManualProtein] = useState('');

  // 八訂食材検索ビルダー
  const [foodQuery, setFoodQuery] = useState('');
  const [foodGrams, setFoodGrams] = useState('100');
  const [foodBoilDrain, setFoodBoilDrain] = useState(false);
  const [pickedFoods, setPickedFoods] = useState<DishIngredientInput[]>([]);

  const foodSearchResults = useMemo(
    () => searchFoodComposition(foodQuery, 8),
    [foodQuery]
  );
  const pickedCalc = useMemo(
    () => calculateDishNutrition(pickedFoods),
    [pickedFoods]
  );

  useEffect(() => {
    const found = vitalLogs.find((v) => v.date === selectedDate);
    setWeightInput(found?.weightKg != null ? String(found.weightKg) : '');
    setSysInput(found?.systolicBp != null ? String(found.systolicBp) : '');
    setDiaInput(found?.diastolicBp != null ? String(found.diastolicBp) : '');
    setFluidInput(found?.fluidIntakeMl != null ? String(found.fluidIntakeMl) : '0');
    setEdema(found?.edema ?? 'none');
    setConditionMemo(found?.conditionMemo ?? '');
    setVitalSavedNotice(false);
  }, [selectedDate, vitalLogs]);

  const mealsForDate = mealLogs.filter((m) => m.date === selectedDate);

  const totals = mealsForDate.reduce(
    (acc, m) => ({
      energy: acc.energy + m.nutrition.caloriesKcal,
      salt: acc.salt + m.nutrition.saltG,
      protein: acc.protein + m.nutrition.proteinG,
      fat: acc.fat + (m.nutrition.fatG ?? 0),
      carb: acc.carb + m.nutrition.carbsG,
      fiber: acc.fiber + (m.nutrition.fiberG ?? 0),
      potassium: acc.potassium + m.nutrition.potassiumMg,
      phosphorus: acc.phosphorus + m.nutrition.phosphorusMg,
      foodWater: acc.foodWater + m.nutrition.fluidMl,
    }),
    {
      energy: 0,
      salt: 0,
      protein: 0,
      fat: 0,
      carb: 0,
      fiber: 0,
      potassium: 0,
      phosphorus: 0,
      foodWater: 0,
    }
  );

  const drinkFluidMl = Number(fluidInput) || 0;
  const totalFluidMl = totals.foodWater + drinkFluidMl;

  const latestVital = [...vitalLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sortedVitalHistory = [...vitalLogs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const handleSaveVital = (e: FormEvent) => {
    e.preventDefault();
    const entry: VitalLogEntry = {
      id: existingVital?.id ?? `vital-${selectedDate}`,
      date: selectedDate,
      recordedAt: new Date().toISOString(),
      weightKg: weightInput.trim() ? Number(weightInput) : null,
      systolicBp: sysInput.trim() ? Number(sysInput) : null,
      diastolicBp: diaInput.trim() ? Number(diaInput) : null,
      fluidIntakeMl: fluidInput.trim() ? Number(fluidInput) : 0,
      edema,
      conditionMemo: conditionMemo.trim(),
    };

    const others = vitalLogs.filter((v) => v.date !== selectedDate);
    onChangeVitalLogs([entry, ...others]);
    setVitalSavedNotice(true);
  };

  const handleQuickAddFluid = (addMl: number) => {
    const nextVal = Math.max(0, (Number(fluidInput) || 0) + addMl);
    setFluidInput(String(nextVal));
    const entry: VitalLogEntry = {
      id: existingVital?.id ?? `vital-${selectedDate}`,
      date: selectedDate,
      recordedAt: new Date().toISOString(),
      weightKg: weightInput.trim() ? Number(weightInput) : null,
      systolicBp: sysInput.trim() ? Number(sysInput) : null,
      diastolicBp: diaInput.trim() ? Number(diaInput) : null,
      fluidIntakeMl: nextVal,
      edema,
      conditionMemo: conditionMemo.trim(),
    };
    const others = vitalLogs.filter((v) => v.date !== selectedDate);
    onChangeVitalLogs([entry, ...others]);
    setVitalSavedNotice(true);
  };

  const handleAddPickedFood = (foodId: string, name: string) => {
    const g = Number(foodGrams);
    if (Number.isNaN(g) || g <= 0) return;
    setPickedFoods((prev) => [
      ...prev,
      {
        name,
        foodId,
        grams: g,
        prepTags: foodBoilDrain ? ['boil_drain'] : undefined,
      },
    ]);
    setFoodBoilDrain(false);
  };

  const handleRemovePickedFood = (idx: number) => {
    setPickedFoods((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddManualMeal = (e: FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    if (manualInputMode === 'food_table') {
      if (pickedFoods.length === 0) return;
      const title =
        manualTitle.trim() ||
        pickedFoods.map((f) => `${f.name}(${f.grams}g)`).join('・');
      const entry: MealLogEntry = {
        id: `meal-log-${Date.now()}`,
        date: selectedDate,
        time,
        slot: manualSlot,
        title,
        portionRatio: 1,
        nutrition: pickedCalc.nutrition,
      };
      onChangeMealLogs([entry, ...mealLogs]);
      setManualTitle('');
      setPickedFoods([]);
      setFoodQuery('');
      setShowManualMeal(false);
      return;
    }

    if (!manualTitle.trim()) return;
    const entry: MealLogEntry = {
      id: `meal-log-${Date.now()}`,
      date: selectedDate,
      time,
      slot: manualSlot,
      title: manualTitle.trim(),
      portionRatio: 1,
      nutrition: {
        caloriesKcal: Number(manualKcal) || 0,
        saltG: Number(manualSalt) || 0,
        proteinG: Number(manualProtein) || 0,
        fatG: 0,
        carbsG: 0,
        fiberG: 0,
        potassiumMg: 0,
        phosphorusMg: 0,
        fluidMl: 0,
      },
    };
    onChangeMealLogs([entry, ...mealLogs]);
    setManualTitle('');
    setManualKcal('');
    setManualSalt('');
    setManualProtein('');
    setShowManualMeal(false);
  };

  const handleDeleteMealLog = (id: string) => {
    onChangeMealLogs(mealLogs.filter((m) => m.id !== id));
  };

  const handleDeleteVitalLog = (id: string) => {
    onChangeVitalLogs(vitalLogs.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 訪問看護・主治医 共有サマリーカード */}
      <section
        className={`rounded-3xl border p-4 shadow-sm transition ${
          nurseShareMode
            ? 'border-teal-700 bg-white ring-4 ring-teal-600/20'
            : 'border-teal-200 bg-gradient-to-br from-teal-700 to-teal-800 text-white'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope
              className={`h-5 w-5 ${nurseShareMode ? 'text-teal-700' : 'text-teal-100'}`}
            />
            <div>
              <p
                className={`text-[11px] font-bold ${
                  nurseShareMode ? 'text-teal-700' : 'text-teal-100'
                }`}
              >
                訪問看護・診察時 共有サマリー
              </p>
              <h2
                className={`text-base font-bold ${
                  nurseShareMode ? 'text-slate-900' : 'text-white'
                }`}
              >
                {selectedDate} の食事・体調状況
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNurseShareMode((v) => !v)}
            className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
              nurseShareMode
                ? 'bg-teal-700 text-white'
                : 'bg-white/18 text-white hover:bg-white/25'
            }`}
          >
            {nurseShareMode ? '通常表示へ' : '看護師提示用'}
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.selectedConditions.map((c) => (
            <span
              key={c}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                nurseShareMode
                  ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                  : 'bg-white/20 text-white'
              }`}
            >
              {getConditionMeta(c).shortName}
            </span>
          ))}
        </div>

        <div
          className={`mt-3 grid grid-cols-2 gap-2 rounded-2xl p-3 sm:grid-cols-4 ${
            nurseShareMode ? 'bg-slate-50 ring-1 ring-slate-200' : 'bg-black/15'
          }`}
        >
          <div>
            <p className={`text-[10px] ${nurseShareMode ? 'text-slate-500' : 'text-teal-100'}`}>
              最新体重
            </p>
            <p className={`text-base font-bold ${nurseShareMode ? 'text-slate-900' : 'text-white'}`}>
              {latestVital?.weightKg != null ? `${latestVital.weightKg}kg` : '未記録'}
            </p>
          </div>
          <div>
            <p className={`text-[10px] ${nurseShareMode ? 'text-slate-500' : 'text-teal-100'}`}>
              最新血圧
            </p>
            <p className={`text-base font-bold ${nurseShareMode ? 'text-slate-900' : 'text-white'}`}>
              {latestVital?.systolicBp != null && latestVital?.diastolicBp != null
                ? `${latestVital.systolicBp}/${latestVital.diastolicBp}`
                : '未記録'}
            </p>
          </div>
          <div>
            <p className={`text-[10px] ${nurseShareMode ? 'text-slate-500' : 'text-teal-100'}`}>
              本日食塩計
            </p>
            <p className={`text-base font-bold ${nurseShareMode ? 'text-slate-900' : 'text-white'}`}>
              {Math.round(totals.salt * 10) / 10}g
            </p>
          </div>
          <div>
            <p className={`text-[10px] ${nurseShareMode ? 'text-slate-500' : 'text-teal-100'}`}>
              本日水分計
            </p>
            <p className={`text-base font-bold ${nurseShareMode ? 'text-slate-900' : 'text-white'}`}>
              {totalFluidMl}mL
            </p>
          </div>
        </div>

        {(existingVital?.conditionMemo || profile.doctorNote) && (
          <div
            className={`mt-2.5 rounded-xl px-3 py-2 text-xs ${
              nurseShareMode
                ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200'
                : 'bg-white/12 text-teal-50'
            }`}
          >
            {existingVital?.conditionMemo && (
              <p>
                <strong>体調メモ：</strong>
                {existingVital.conditionMemo}（{EDEMA_META[existingVital.edema].label}）
              </p>
            )}
            {profile.doctorNote && (
              <p className="mt-0.5">
                <strong>病院指示メモ：</strong>
                {profile.doctorNote}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 日付選択 */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Calendar className="h-4 w-4 text-teal-700" />
          記録日を選択
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900"
        />
      </div>

      {/* 1. 本日の栄養累計ゲージ＆食事記録一覧 */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">1日の食事・栄養累計</h2>
              <p className="text-[11px] text-slate-500">
                1日基準に対する累計（{mealsForDate.length}食記録・下限は1日合計で判断）
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowManualMeal((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
          >
            <Plus className="h-3.5 w-3.5" />
            手動で記録
          </button>
        </div>

        <div className="mt-3.5 space-y-3">
          <DailyTargetGaugeRow
            nutrient="energy"
            current={totals.energy}
            target={dailyResult.targets.energy}
          />
          <DailyTargetGaugeRow
            nutrient="salt"
            current={totals.salt}
            target={dailyResult.targets.salt}
          />
          <DailyTargetGaugeRow
            nutrient="protein"
            current={totals.protein}
            target={dailyResult.targets.protein}
          />
          <DailyTargetGaugeRow
            nutrient="potassium"
            current={totals.potassium}
            target={dailyResult.targets.potassium}
          />
          {profile.selectedConditions.includes('kidney_disease') && (
            <DailyTargetGaugeRow
              nutrient="phosphorus"
              current={totals.phosphorus}
              target={dailyResult.targets.phosphorus}
            />
          )}
          <DailyTargetGaugeRow
            nutrient="fiber"
            current={totals.fiber}
            target={dailyResult.targets.fiber}
          />
          {(profile.selectedConditions.includes('heart_failure') ||
            profile.selectedConditions.includes('kidney_disease') ||
            profile.instructions.water) && (
            <DailyTargetGaugeRow
              nutrient="water"
              current={totalFluidMl}
              target={dailyResult.targets.water}
            />
          )}
        </div>

        {showManualMeal && (
          <form
            onSubmit={handleAddManualMeal}
            className="mt-4 space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-3.5"
          >
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white p-1 ring-1 ring-teal-200">
              <button
                type="button"
                onClick={() => setManualInputMode('food_table')}
                className={`rounded-lg py-1.5 text-xs font-bold ${
                  manualInputMode === 'food_table'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600'
                }`}
              >
                八訂食材から自動計算
              </button>
              <button
                type="button"
                onClick={() => setManualInputMode('label')}
                className={`rounded-lg py-1.5 text-xs font-bold ${
                  manualInputMode === 'label'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600'
                }`}
              >
                食品表示を直接入力
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setManualSlot(slot)}
                  className={`rounded-xl py-1.5 text-xs font-bold ${
                    manualSlot === slot
                      ? 'bg-teal-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {MEAL_SLOT_LABEL[slot]}
                </button>
              ))}
            </div>

            {manualInputMode === 'food_table' ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="料理名メモ（任意：空欄なら選んだ食材名で登録）"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                />

                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={foodQuery}
                      onChange={(e) => setFoodQuery(e.target.value)}
                      placeholder="八訂食材を検索（例：ごはん、鶏むね、減塩醤油）"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-2.5 pl-8 text-xs text-slate-900"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={foodGrams}
                      onChange={(e) => setFoodGrams(e.target.value)}
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-600">g</span>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-900">
                  <input
                    type="checkbox"
                    checked={foodBoilDrain}
                    onChange={(e) => setFoodBoilDrain(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-teal-300 text-teal-700"
                  />
                  ゆでこぼし・水さらしあり（減る分は引かず生の値で多めに表示）
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {foodSearchResults.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      title={food.official}
                      onClick={() => handleAddPickedFood(food.id, food.name)}
                      className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100"
                    >
                      + {food.name}
                      <span className="ml-1 text-[9px] text-slate-400">[{food.id}]</span>
                    </button>
                  ))}
                </div>

                {pickedFoods.length > 0 && (
                  <div className="space-y-1.5 rounded-xl bg-white p-2.5 ring-1 ring-teal-200">
                    <ul className="space-y-1 text-[11px]">
                      {pickedCalc.matchedItems.map((m, idx) => (
                        <li
                          key={`${m.inputName}-${idx}`}
                          className="flex items-start justify-between gap-2 text-slate-700"
                        >
                          <div>
                            <span className="font-semibold">
                              {m.inputName} {m.grams}g
                              {m.prepTags.includes('boil_drain') ? '（ゆでこぼし）' : ''}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              [{m.matchedFood.id}] {m.matchedFood.official}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePickedFood(idx)}
                            className="shrink-0 text-rose-600 hover:underline"
                          >
                            削除
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-slate-100 pt-1.5 text-[11px] font-bold text-teal-900">
                      八訂合算：
                      {pickedCalc.exactNutrition.energy == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.energy}kcal`}{' '}
                      ／ 食塩{' '}
                      {pickedCalc.exactNutrition.salt == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.salt}g`}{' '}
                      ／ たんぱく{' '}
                      {pickedCalc.exactNutrition.protein == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.protein}g`}{' '}
                      ／ K{' '}
                      {pickedCalc.exactNutrition.potassium == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.potassium}mg`}{' '}
                      ／ P{' '}
                      {pickedCalc.exactNutrition.phosphorus == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.phosphorus}mg`}{' '}
                      ／ 食物繊維{' '}
                      {pickedCalc.exactNutrition.fiber == null
                        ? 'データなし'
                        : `${pickedCalc.exactNutrition.fiber}g`}
                    </p>
                    {pickedCalc.prepNotices.length > 0 && (
                      <p className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">
                        ※ {pickedCalc.prepNotices.join(' / ')}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pickedFoods.length === 0}
                  className="w-full rounded-xl bg-teal-700 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                >
                  八訂計算の結果を食事記録に追加する
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="市販品名（例：減塩カップスープ、ヨーグルト）"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                />
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] font-semibold text-slate-600">
                    エネルギー(kcal)
                    <input
                      type="number"
                      value={manualKcal}
                      onChange={(e) => setManualKcal(e.target.value)}
                      placeholder="0"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-slate-600">
                    食塩相当量(g)
                    <input
                      type="number"
                      step={0.1}
                      value={manualSalt}
                      onChange={(e) => setManualSalt(e.target.value)}
                      placeholder="0"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900"
                    />
                  </label>
                  <label className="text-[10px] font-semibold text-slate-600">
                    たんぱく質(g)
                    <input
                      type="number"
                      step={0.1}
                      value={manualProtein}
                      onChange={(e) => setManualProtein(e.target.value)}
                      placeholder="0"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={!manualTitle.trim()}
                  className="w-full rounded-xl bg-teal-700 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                >
                  食品表示の値で記録に追加する
                </button>
              </div>
            )}
          </form>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
          {mealsForDate.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-600">
                この日の食事記録はまだありません
              </p>
              <button
                type="button"
                onClick={onGoToMeals}
                className="mt-2 inline-flex items-center gap-1 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                献立提案から「食べた」ボタンで記録する
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {mealsForDate.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                        {MEAL_SLOT_LABEL[log.slot]}
                      </span>
                      <span className="text-[10px] text-slate-400">{log.time}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-900">
                      {log.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {log.nutrition.caloriesKcal}kcal ／ 食塩 {log.nutrition.saltG}g ／ たんぱく{' '}
                      {log.nutrition.proteinG}g
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMealLog(log.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="食事記録を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. 体重・血圧・水分・むくみ・体調メモ記録 */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">体重・血圧・体調ログ</h2>
            <p className="text-[11px] text-slate-500">
              心不全・腎臓病のむくみ確認や訪問看護での経過共有に活用できます
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveVital} className="mt-3.5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <Scale className="h-3.5 w-3.5 text-teal-700" />
                体重 (kg)
              </span>
              <input
                type="number"
                step={0.1}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="58.5"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-900"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <Activity className="h-3.5 w-3.5 text-rose-600" />
                血圧 上
              </span>
              <input
                type="number"
                value={sysInput}
                onChange={(e) => setSysInput(e.target.value)}
                placeholder="128"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-900"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5">
              <span className="text-[11px] font-semibold text-slate-600">血圧 下</span>
              <input
                type="number"
                value={diaInput}
                onChange={(e) => setDiaInput(e.target.value)}
                placeholder="78"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-900"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <Droplets className="h-4 w-4 text-sky-600" />
                飲水・水分摂取量 (mL)
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddFluid(150)}
                  className="rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-bold text-white"
                >
                  +150mL
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddFluid(200)}
                  className="rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-bold text-white"
                >
                  +200mL
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step={50}
                value={fluidInput}
                onChange={(e) => setFluidInput(e.target.value)}
                className="w-28 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900"
              />
              <span className="text-xs text-slate-600">
                mL（食事由来 {totals.foodWater}mL と合わせて計 <strong>{totalFluidMl}mL</strong>）
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700">むくみの状態</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(['none', 'mild', 'moderate'] as EdemaLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEdema(lvl)}
                  className={`rounded-xl border py-2 text-xs font-bold ${
                    edema === lvl
                      ? `${EDEMA_META[lvl].color} ring-2 ring-teal-500/25`
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {EDEMA_META[lvl].label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-700">むくみ・体調メモ</span>
            <textarea
              rows={2}
              value={conditionMemo}
              onChange={(e) => setConditionMemo(e.target.value)}
              placeholder="例：朝の足のむくみ少しあり、食欲は8割ほど"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
          </label>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-teal-700 py-3 text-sm font-bold text-white shadow-xs hover:bg-teal-800"
          >
            <ClipboardCheck className="h-4 w-4" />
            {selectedDate} の体調ログを保存する
          </button>

          {vitalSavedNotice && (
            <p className="text-center text-xs font-bold text-emerald-700">
              体調ログを保存しました。上の共有サマリーにも反映されています。
            </p>
          )}
        </form>
      </section>

      {/* 3. 最近の体調・バイタル履歴一覧 */}
      <section className="space-y-2">
        <h3 className="px-1 text-xs font-bold text-slate-600">
          最近の体調・バイタル記録一覧（直近7件）
        </h3>
        {sortedVitalHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-center text-xs text-slate-500">
            まだバイタル記録がありません。
          </div>
        ) : (
          <div className="space-y-2">
            {sortedVitalHistory.map((v) => (
              <div
                key={v.id}
                className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{v.date}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${EDEMA_META[v.edema].color}`}
                    >
                      {EDEMA_META[v.edema].label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
                    <span>体重: {v.weightKg != null ? `${v.weightKg}kg` : '-'}</span>
                    <span>
                      血圧:{' '}
                      {v.systolicBp != null && v.diastolicBp != null
                        ? `${v.systolicBp}/${v.diastolicBp}`
                        : '-'}
                    </span>
                    <span>飲水: {v.fluidIntakeMl ?? 0}mL</span>
                  </div>
                  {v.conditionMemo && (
                    <p className="text-[11px] text-slate-500">{v.conditionMemo}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteVitalLog(v.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`${v.date}の記録を削除`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        栄養価計算出典：{FOOD_COMPOSITION_SOURCE_LABEL}（
        <a
          href={FOOD_COMPOSITION_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 underline"
        >
          文部科学省
        </a>
        ）
      </p>
    </div>
  );
}
