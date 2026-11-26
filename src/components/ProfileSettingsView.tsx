import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Percent,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { CONDITIONS, profileToNutritionInput } from '../data/conditions';
import {
  calculateDailyTargets,
  formatDailyTarget,
  validateMealRatios,
} from '../nutrition/calculator';
import {
  ACTIVITY_DESCRIPTIONS,
  CIRRHOSIS_ASCITES_OPTIONS,
  CKD_STAGE_OPTIONS,
  D13_CHEMO_GUIDANCE,
  NUTRIENT_META,
  REFERENCE_SOURCES,
  type ActivityLevel,
  type BiologicalSex,
  type ChemoSymptomKey,
  type CirrhosisAscitesStatus,
  type CkdStage,
  type NutrientKey,
} from '../nutrition/referenceData';
import type {
  ConditionId,
  FamilyMemberProfile,
  InstructionCompare,
  LegalTab,
  UserProfile,
} from '../types';

interface ProfileSettingsViewProps {
  profile: UserProfile;
  onChangeProfile: (next: UserProfile) => void;
  onOpenLegal: (tab: LegalTab) => void;
  onExportBackup: () => void;
  onImportBackup: (rawJsonText: string) => void;
  onGoToMeals: () => void;
}

const COMPARE_LABELS: Record<InstructionCompare, string> = {
  lt: '未満',
  le: '以下',
  ge: '以上',
  about: 'くらい',
};

const DISPLAY_NUTRIENTS: NutrientKey[] = [
  'energy',
  'protein',
  'salt',
  'potassium',
  'phosphorus',
  'water',
  'fiber',
  'fat',
  'carb',
];

export function ProfileSettingsView({
  profile,
  onChangeProfile,
  onOpenLegal,
  onExportBackup,
  onImportBackup,
  onGoToMeals,
}: ProfileSettingsViewProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingInstructionKey, setEditingInstructionKey] =
    useState<NutrientKey | null>(null);
  const [instValDraft, setInstValDraft] = useState('');
  const [instCompareDraft, setInstCompareDraft] =
    useState<InstructionCompare>('about');

  // 食事配分ドラフト（合計100%でなければ保存しない）
  const [ratioDraft, setRatioDraft] = useState(profile.mealRatios);
  const [ratioError, setRatioError] = useState<string | null>(null);
  const [ratioSavedMsg, setRatioSavedMsg] = useState(false);

  // ご家族メンバー追加フォーム
  const [famName, setFamName] = useState('');
  const [famAge, setFamAge] = useState('35');
  const [famSex, setFamSex] = useState<BiologicalSex>('female');
  const [famHeight, setFamHeight] = useState('160');
  const [famWeight, setFamWeight] = useState('52');
  const [famCondition, setFamCondition] = useState<ConditionId>('standard');

  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRatioDraft(profile.mealRatios);
  }, [profile.mealRatios]);

  const dailyResult = useMemo(
    () => calculateDailyTargets(profileToNutritionInput(profile)),
    [profile]
  );

  const isCkdSelected = profile.selectedConditions.includes('kidney_disease');
  const isLiverSelected = profile.selectedConditions.includes('liver_cirrhosis');
  const isChemoSelected = profile.selectedConditions.includes('chemo_side_effects');

  const handleToggleCondition = (condId: ConditionId) => {
    let nextSelected: ConditionId[];
    const exists = profile.selectedConditions.includes(condId);

    if (condId === 'standard') {
      nextSelected = ['standard'];
    } else if (exists) {
      nextSelected = profile.selectedConditions.filter((c) => c !== condId);
      if (nextSelected.length === 0) {
        nextSelected = ['standard'];
      }
    } else {
      nextSelected = [
        ...profile.selectedConditions.filter((c) => c !== 'standard'),
        condId,
      ];
    }

    onChangeProfile({
      ...profile,
      selectedConditions: nextSelected,
      chemoSymptoms: nextSelected.includes('chemo_side_effects')
        ? profile.chemoSymptoms
        : [],
      avoidRawFood: nextSelected.includes('chemo_side_effects')
        ? profile.avoidRawFood
        : false,
    });
  };

  const handleToggleChemoSymptom = (symptomKey: ChemoSymptomKey) => {
    const exists = profile.chemoSymptoms.includes(symptomKey);
    const next = exists
      ? profile.chemoSymptoms.filter((s) => s !== symptomKey)
      : [...profile.chemoSymptoms, symptomKey];
    onChangeProfile({ ...profile, chemoSymptoms: next });
  };

  const openInstructionEditor = (key: NutrientKey) => {
    if (profile.doctorTargetsLocked) return;
    const existing = profile.instructions[key];
    setEditingInstructionKey(key);
    setInstValDraft(existing ? String(existing.value) : '');
    setInstCompareDraft(
      existing?.compare ?? (key === 'salt' ? 'lt' : key === 'energy' ? 'about' : 'le')
    );
  };

  const handleSaveInstruction = (key: NutrientKey) => {
    if (profile.doctorTargetsLocked) return;
    const num = Number(instValDraft);
    if (!instValDraft.trim() || Number.isNaN(num) || num < 0) return;
    onChangeProfile({
      ...profile,
      instructions: {
        ...profile.instructions,
        [key]: { value: num, compare: instCompareDraft },
      },
    });
    setEditingInstructionKey(null);
  };

  const handleClearInstruction = (key: NutrientKey) => {
    if (profile.doctorTargetsLocked) return;
    const next = { ...profile.instructions };
    delete next[key];
    onChangeProfile({ ...profile, instructions: next });
    setEditingInstructionKey(null);
  };

  const handleSaveMealRatios = (e: FormEvent) => {
    e.preventDefault();
    const check = validateMealRatios(ratioDraft);
    if (!check.valid) {
      setRatioError(check.error ?? '合計を100%にしてください。');
      setRatioSavedMsg(false);
      return;
    }
    setRatioError(null);
    onChangeProfile({ ...profile, mealRatios: ratioDraft });
    setRatioSavedMsg(true);
    window.setTimeout(() => setRatioSavedMsg(false), 2500);
  };

  const handleToggleLock = () => {
    if (profile.doctorTargetsLocked) {
      if (
        window.confirm(
          '病院の指示値ロックを解除して編集できるようにしますか？'
        )
      ) {
        onChangeProfile({ ...profile, doctorTargetsLocked: false });
      }
    } else {
      setEditingInstructionKey(null);
      onChangeProfile({ ...profile, doctorTargetsLocked: true });
    }
  };

  const handleAddFamilyMember = (e: FormEvent) => {
    e.preventDefault();
    if (!famName.trim()) return;
    const newMember: FamilyMemberProfile = {
      id: `fam-${Date.now()}`,
      name: famName.trim(),
      age: Number(famAge) || 35,
      sex: famSex,
      heightCm: Number(famHeight) || 160,
      weightKg: Number(famWeight) || 55,
      activity: 'normal',
      selectedConditions: [famCondition],
      ckdStage: 'unknown',
      cirrhosisAscites: 'unknown',
      instructions: {},
    };
    onChangeProfile({
      ...profile,
      familyMembers: [...profile.familyMembers, newMember],
    });
    setFamName('');
  };

  const handleRemoveFamilyMember = (id: string) => {
    onChangeProfile({
      ...profile,
      familyMembers: profile.familyMembers.filter((m) => m.id !== id),
    });
  };

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onImportBackup(text);
      setBackupFeedback({
        type: 'success',
        message: 'バックアップJSONからデータを復元しました。',
      });
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'バックアップファイルの読み込みに失敗しました。',
      });
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 免責事項（安全のきまり5） */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/85 p-3.5 text-xs text-amber-950">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="font-bold leading-relaxed">
              この目安は一般的な値で、診断・治療の代わりではありません。主治医・管理栄養士の指示がある場合は、必ず指示を優先して入力してください。
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onOpenLegal('disclaimer')}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-300"
              >
                医療免責事項
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                利用規約
              </button>
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                プライバシー
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 1. 基本プロフィール（年齢・性別・身長・体重・活動量） */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              基本プロフィール（基準計算に使用）
            </h2>
            <p className="text-[11px] text-slate-500">
              日本人の食事摂取基準（2025年版）・標準体重（SW）・BMIの自動計算に使います
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">年齢 (1歳〜)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={profile.age ?? ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  age: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </label>

          <div className="block">
            <span className="text-[11px] font-semibold text-slate-600">性別</span>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {(
                [
                  { id: 'male', label: '男性' },
                  { id: 'female', label: '女性' },
                ] as { id: BiologicalSex; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeProfile({ ...profile, sex: s.id })}
                  className={`rounded-xl border py-2 text-xs font-bold ${
                    profile.sex === s.id
                      ? 'border-teal-600 bg-teal-700 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">身長 (cm)</span>
            <input
              type="number"
              min={50}
              max={230}
              value={profile.heightCm ?? ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  heightCm: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">体重 (kg)</span>
            <input
              type="number"
              step={0.1}
              min={5}
              max={250}
              value={profile.weightKg ?? ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  weightKg: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </label>
        </div>

        {/* 身体活動レベル（DRI2025 表5説明つき） */}
        <div className="mt-3">
          <span className="text-[11px] font-semibold text-slate-600">
            身体活動レベル（DRI2025 表4・表5）
          </span>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {(['low', 'normal', 'high'] as ActivityLevel[]).map((act) => {
              const info = ACTIVITY_DESCRIPTIONS[act];
              const active = profile.activity === act;
              return (
                <button
                  key={act}
                  type="button"
                  onClick={() => onChangeProfile({ ...profile, activity: act })}
                  className={`rounded-2xl border p-2.5 text-left transition ${
                    active
                      ? 'border-teal-600 bg-teal-50/80 ring-1 ring-teal-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{info.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-600">
                    {info.description}
                  </p>
                  {profile.age != null && profile.age >= 75 && info.senior75Note && (
                    <p className="mt-1 text-[10px] font-semibold text-amber-800">
                      ※{info.senior75Note}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 自動算出指標サマリー */}
        <div className="mt-3 grid grid-cols-4 divide-x divide-slate-200/80 rounded-2xl bg-slate-50 p-2.5 text-center ring-1 ring-slate-200/70">
          <div>
            <p className="text-[10px] text-slate-500">標準体重(SW)</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">
              {dailyResult.standardWeightKg != null
                ? `${dailyResult.standardWeightKg}kg`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">BMI</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">
              {dailyResult.bmi != null ? dailyResult.bmi.toFixed(1) : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">基礎代謝目安</p>
            <p className="mt-0.5 text-xs font-bold text-slate-900">
              {dailyResult.bmrKcal != null ? `${dailyResult.bmrKcal}` : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">EER(DRI2025)</p>
            <p className="mt-0.5 text-xs font-bold text-teal-700">
              {dailyResult.eerKcal != null ? `${dailyResult.eerKcal}kcal` : '-'}
            </p>
          </div>
        </div>

        {/* 作る人数（1〜6人分） */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-teal-700" />
            <span className="text-xs font-bold text-slate-800">調理する人数（1〜6人分）</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const active = profile.servings === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => onChangeProfile({ ...profile, servings: num })}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    active
                      ? 'border-teal-600 bg-teal-700 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {num}人分
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. 病気・状態モード選択 */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">病気・状態モード</h2>
          </div>
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">
            複数選択・安全側自動統合
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {CONDITIONS.map((cond) => {
            const selected = profile.selectedConditions.includes(cond.id);
            return (
              <div key={cond.id}>
                <button
                  type="button"
                  onClick={() => handleToggleCondition(cond.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                    selected
                      ? 'border-teal-600 bg-teal-50/60 ring-1 ring-teal-600/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/70'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      selected
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">{cond.name}</span>
                      {cond.sources.map((src) => (
                        <span
                          key={src}
                          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {cond.description}
                    </p>
                  </div>
                </button>

                {/* 腎臓病ステージ選択 */}
                {cond.id === 'kidney_disease' && isCkdSelected && (
                  <div className="mt-2 ml-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3">
                    <p className="text-xs font-bold text-indigo-950">
                      腎臓病のステージを選択（JSN2014）
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {CKD_STAGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onChangeProfile({ ...profile, ckdStage: opt.id as CkdStage })
                          }
                          className={`rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                            profile.ckdStage === opt.id
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-indigo-200 bg-white text-slate-700 hover:bg-indigo-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 肝硬変 腹水の有無 */}
                {cond.id === 'liver_cirrhosis' && isLiverSelected && (
                  <div className="mt-2 ml-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <p className="text-xs font-bold text-emerald-950">
                      腹水の有無を選択（JSGE2023）
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {CIRRHOSIS_ASCITES_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onChangeProfile({
                              ...profile,
                              cirrhosisAscites: opt.id as CirrhosisAscitesStatus,
                            })
                          }
                          className={`rounded-xl border py-2 text-xs font-bold ${
                            profile.cirrhosisAscites === opt.id
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-emerald-200 bg-white text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 抗がん剤副作用（GANJOHO 7症状＋生もの回避） */}
                {cond.id === 'chemo_side_effects' && isChemoSelected && (
                  <div className="mt-2 ml-3 space-y-2.5 rounded-2xl border border-purple-200 bg-purple-50/60 p-3">
                    <p className="text-xs font-bold text-purple-950">
                      今の症状を選択してください（GANJOHO・複数選択可）
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {D13_CHEMO_GUIDANCE.map((sym) => {
                        const active = profile.chemoSymptoms.includes(sym.id);
                        return (
                          <button
                            key={sym.id}
                            type="button"
                            onClick={() => handleToggleChemoSymptom(sym.id)}
                            className={`flex items-start gap-2 rounded-xl border p-2.5 text-left ${
                              active
                                ? 'border-purple-600 bg-white shadow-2xs'
                                : 'border-purple-200/70 bg-white/60'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                active
                                  ? 'border-purple-600 bg-purple-600 text-white'
                                  : 'border-purple-300 bg-white'
                              }`}
                            >
                              {active && <Check className="h-3 w-3 stroke-[3]" />}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{sym.name}</p>
                              <p className="mt-0.5 text-[10px] text-slate-600">
                                {sym.cookingForms.join(' / ')}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-purple-300 bg-white p-2.5">
                      <input
                        type="checkbox"
                        checked={profile.avoidRawFood}
                        onChange={(e) =>
                          onChangeProfile({ ...profile, avoidRawFood: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-purple-300 text-purple-700"
                      />
                      <span className="text-xs text-slate-800">
                        <strong>生ものを避けるよう言われている</strong>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          生肉・刺身・生野菜・非加熱の発酵食品・ドライフルーツを含む料理を献立提案から自動除外します
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 自動計算のお知らせ（75歳以上high、18歳未満、ダイエット安全ルール等） */}
        {dailyResult.notices.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50/85 p-3 text-xs text-amber-950">
            <p className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              計算上のお知らせ・ご注意
            </p>
            {dailyResult.notices.map((n, i) => (
              <p key={i} className="leading-relaxed">
                ・{n}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* 3. 1日の栄養目安＆病院の指示（最優先・ロック対応） */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1日の栄養目安と「病院の指示」設定
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              病院の指示（主治医・管理栄養士）はどの初期値よりも最優先されます
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLock}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              profile.doctorTargetsLocked
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {profile.doctorTargetsLocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                病院指示ロック中（解除）
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" />
                指示値をロック
              </>
            )}
          </button>
        </div>

        <div className="mt-3 space-y-2.5">
          {DISPLAY_NUTRIENTS.map((key) => {
            const meta = NUTRIENT_META[key];
            const val = dailyResult.targets[key];
            const isEditing = editingInstructionKey === key;

            const isInstruction = val.type === 'instruction';
            const isNeedInst = val.type === 'needInstruction';
            const isMissing = val.type === 'missing';

            return (
              <div
                key={key}
                className={`rounded-2xl border p-3 ${
                  isInstruction
                    ? 'border-teal-500 bg-teal-50/50'
                    : isNeedInst
                      ? 'border-amber-300 bg-amber-50/60'
                      : isMissing
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-200/90 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">{meta.label}</span>
                      {isInstruction && (
                        <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          病院の指示（最優先）
                        </span>
                      )}
                      {isNeedInst && (
                        <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          病院の指示が必要
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1 text-sm font-bold ${
                        isNeedInst
                          ? 'text-amber-900'
                          : isInstruction
                            ? 'text-teal-900'
                            : 'text-slate-900'
                      }`}
                    >
                      {formatDailyTarget(val, meta.unit)}
                    </p>

                    {/* 病院の指示入力時も根拠（初期計算結果）を確認できる */}
                    {val.type === 'instruction' && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        （参考・初期基準：{formatDailyTarget(val.referenceResult, meta.unit)}）
                      </p>
                    )}

                    {/* メッセージ・注記 */}
                    {val.type === 'needInstruction' && (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900">
                        {val.messages.map((m, i) => (
                          <li key={i}>・{m}</li>
                        ))}
                      </ul>
                    )}
                    {(val.type === 'range' || val.type === 'text') &&
                      val.notes.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                          {val.notes.map((n, i) => (
                            <li key={i}>※{n}</li>
                          ))}
                        </ul>
                      )}

                    {/* 出典リンク（安全のきまり3） */}
                    {val.sources.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {val.sources.map((srcId) => {
                          const src = REFERENCE_SOURCES[srcId];
                          return (
                            <a
                              key={srcId}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100"
                            >
                              出典: {src.sourceId}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!profile.doctorTargetsLocked && (
                    <button
                      type="button"
                      onClick={() =>
                        isEditing ? setEditingInstructionKey(null) : openInstructionEditor(key)
                      }
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-teal-400 hover:text-teal-800"
                    >
                      {isEditing ? '閉じる' : isInstruction ? '指示を変更' : '病院の指示を入力'}
                    </button>
                  )}
                </div>

                {/* インライン病院指示入力フォーム */}
                {isEditing && !profile.doctorTargetsLocked && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2.5">
                    <input
                      type="number"
                      step={key === 'salt' ? 0.1 : 1}
                      value={instValDraft}
                      onChange={(e) => setInstValDraft(e.target.value)}
                      placeholder={`1日の数値 (${meta.unit})`}
                      className="w-28 rounded-xl border border-teal-300 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900"
                    />
                    <select
                      value={instCompareDraft}
                      onChange={(e) =>
                        setInstCompareDraft(e.target.value as InstructionCompare)
                      }
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    >
                      {(Object.keys(COMPARE_LABELS) as InstructionCompare[]).map((c) => (
                        <option key={c} value={c}>
                          {COMPARE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSaveInstruction(key)}
                      className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
                    >
                      指示を保存
                    </button>
                    {isInstruction && (
                      <button
                        type="button"
                        onClick={() => handleClearInstruction(key)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700"
                      >
                        指示を解除
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 主治医メモ */}
        <label className="mt-3 block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            主治医・訪問看護師・管理栄養士からのメモ（任意）
          </span>
          <textarea
            rows={2}
            disabled={profile.doctorTargetsLocked}
            value={profile.doctorNote}
            onChange={(e) => onChangeProfile({ ...profile, doctorNote: e.target.value })}
            placeholder="例：1日水分1200ml以内、塩分6g未満、食形態は医師指示に従う など"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 disabled:bg-slate-100"
          />
        </label>
      </section>

      {/* 4. 1食あたりの配分設定（合計100%チェック） */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">1食あたりの配分（朝・昼・夕）</h2>
            <p className="text-[11px] text-slate-500">
              初期配分は 朝30%・昼35%・夕35%。合計100%のときのみ保存されます
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveMealRatios} className="mt-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'breakfast', label: '朝食 (%)' },
                { key: 'lunch', label: '昼食 (%)' },
                { key: 'dinner', label: '夕食 (%)' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5"
              >
                <span className="text-[11px] font-semibold text-slate-600">
                  {item.label}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={ratioDraft[item.key]}
                  onChange={(e) =>
                    setRatioDraft((prev) => ({
                      ...prev,
                      [item.key]: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-900"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              合計：{ratioDraft.breakfast + ratioDraft.lunch + ratioDraft.dinner}%
            </span>
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800"
            >
              配分を保存
            </button>
          </div>

          {ratioError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {ratioError}
            </p>
          )}
          {ratioSavedMsg && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              食事配分を保存しました。
            </p>
          )}
        </form>
      </section>

      {/* 5. ご家族メンバー管理（1人ずつ1食比較用） */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              一緒に食べるご家族（個別比較）
            </h2>
            <p className="text-[11px] text-slate-500">
              同じ献立でも、ご本人とご家族それぞれの基準で1人ずつ比較できます
            </p>
          </div>
        </div>

        {profile.familyMembers.length > 0 && (
          <ul className="mt-3 space-y-2">
            {profile.familyMembers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{m.name}</span>
                  <span className="ml-2 text-slate-500">
                    {m.age}歳・{m.sex === 'male' ? '男性' : '女性'}・{m.heightCm}cm/{m.weightKg}kg（
                    {CONDITIONS.find((c) => c.id === m.selectedConditions[0])?.shortName ??
                      '病気なし'}
                    ）
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFamilyMember(m.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`${m.name}を削除`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddFamilyMember} className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={famName}
              onChange={(e) => setFamName(e.target.value)}
              placeholder="お名前（例：夫、長男）"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            />
            <select
              value={famCondition}
              onChange={(e) => setFamCondition(e.target.value as ConditionId)}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold"
            >
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <input
              type="number"
              value={famAge}
              onChange={(e) => setFamAge(e.target.value)}
              placeholder="年齢"
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
            <select
              value={famSex}
              onChange={(e) => setFamSex(e.target.value as BiologicalSex)}
              className="rounded-xl border border-slate-200 bg-white px-1.5 py-1.5 text-xs"
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
            <input
              type="number"
              value={famHeight}
              onChange={(e) => setFamHeight(e.target.value)}
              placeholder="身長cm"
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
            <input
              type="number"
              value={famWeight}
              onChange={(e) => setFamWeight(e.target.value)}
              placeholder="体重kg"
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={!famName.trim()}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-slate-800 py-2 text-xs font-bold text-white disabled:bg-slate-300"
          >
            <Plus className="h-3.5 w-3.5" />
            ご家族を追加する
          </button>
        </form>
      </section>

      {/* 6. 採用している出典・ガイドライン一覧 */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-teal-700" />
          <h2 className="text-sm font-bold text-slate-900">
            初期目安値・栄養計算の出典一覧
          </h2>
        </div>
        <ul className="mt-2.5 space-y-2 text-xs">
          {Object.values(REFERENCE_SOURCES).map((src) => (
            <li
              key={src.sourceId}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800">
                  [{src.sourceId}] {src.name}
                </span>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 font-bold text-teal-700 underline"
                >
                  参照
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {src.note && (
                <p className="mt-0.5 text-[11px] text-slate-500">{src.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 7. AI連携設定（Gemini API） */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">AI連携設定（Gemini API）</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          AI提案時も、栄養数値はAIに作らせず、文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成したマスターデータからアプリ内で計算します。
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChangeProfile({ ...profile, generationMode: 'rule' })}
            className={`rounded-2xl border p-3 text-left ${
              profile.generationMode === 'rule'
                ? 'border-teal-600 bg-teal-50/80'
                : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-bold text-slate-900">ルールベース（標準）</p>
            <p className="mt-0.5 text-[11px] text-slate-500">APIキー不要・無料・高速</p>
          </button>

          <button
            type="button"
            onClick={() => onChangeProfile({ ...profile, generationMode: 'gemini' })}
            className={`rounded-2xl border p-3 text-left ${
              profile.generationMode === 'gemini'
                ? 'border-teal-600 bg-teal-50/80'
                : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-xs font-bold text-slate-900">Gemini AI生成</p>
            <p className="mt-0.5 text-[11px] text-slate-500">献立提案・チラシ読取</p>
          </button>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <KeyRound className="h-3.5 w-3.5 text-slate-500" />
            Gemini APIキー（任意・ブラウザ内のみ保存）
          </label>
          <div className="relative mt-1.5">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={profile.geminiApiKey}
              onChange={(e) => onChangeProfile({ ...profile, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pr-11 pl-3 text-sm text-slate-800"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-slate-400"
              aria-label="APIキー表示切替"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      {/* 8. JSONバックアップ書き出し・復元 */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              データ引き継ぎ・バックアップ（JSON）
            </h2>
            <p className="text-xs text-slate-500">
              端末変更やご家族・訪問看護でのデータ引き継ぎに使えます
            </p>
          </div>
        </div>

        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFileChange}
          className="hidden"
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onExportBackup();
              setBackupFeedback({
                type: 'success',
                message: 'バックアップファイル（JSON）を書き出しました。',
              });
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900 hover:bg-teal-100"
          >
            <Download className="h-4 w-4" />
            バックアップ書き出し（JSON）
          </button>

          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            バックアップ復元（JSON読込）
          </button>
        </div>

        {backupFeedback && (
          <p
            className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
              backupFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-rose-50 text-rose-800'
            }`}
          >
            {backupFeedback.message}
          </p>
        )}
      </section>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
        <span>設定は自動的にブラウザ内へ保存されます</span>
      </div>

      <button
        type="button"
        onClick={onGoToMeals}
        className="w-full rounded-2xl bg-teal-700 py-3.5 text-base font-bold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800"
      >
        この設定で献立提案を見る →
      </button>
    </div>
  );
}
