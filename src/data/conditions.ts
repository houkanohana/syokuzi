import type { PersonNutritionInput } from '../nutrition/calculator';
import type {
  ChemoSymptomKey,
  SourceId,
} from '../nutrition/referenceData';
import { D13_CHEMO_GUIDANCE } from '../nutrition/referenceData';
import type { ConditionId, FamilyMemberProfile, UserProfile } from '../types';

export interface ConditionMeta {
  id: ConditionId;
  name: string;
  shortName: string;
  description: string;
  badgeColor: string;
  sources: SourceId[];
}

export const CONDITIONS: ConditionMeta[] = [
  {
    id: 'standard',
    name: '病気なし（日本人の食事摂取基準2025）',
    shortName: '病気なし',
    description:
      '年齢・性別・体重・身体活動レベルから、国の基準（DRI2025）の推定エネルギー・食塩・カリウム・たんぱく質・食物繊維を算出します',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    sources: ['DRI2025'],
  },
  {
    id: 'hypertension',
    name: '高血圧',
    shortName: '高血圧',
    description: '食塩相当量 6g/日未満（JSH）を基準とします',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    sources: ['JSH'],
  },
  {
    id: 'diabetes',
    name: '糖尿病',
    shortName: '糖尿病',
    description:
      '食塩 6g/日未満。カロリーは個別性が高いため初期値を置かず、病院の指示を入力します（炭水化物も割合目標にしません）',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    sources: ['JDS2024', 'JSH', 'DRI2025'],
  },
  {
    id: 'heart_failure',
    name: '心不全',
    shortName: '心不全',
    description:
      '食塩・水分は個別判断のため病院の指示を優先。たんぱく質は不足予防（65歳未満 1.1g/kg以上、65歳以上 1.2〜1.5g/kg）',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
    sources: ['JCS2025'],
  },
  {
    id: 'kidney_disease',
    name: '腎臓病（CKD・透析）',
    shortName: '腎臓病',
    description:
      'ステージ（G1〜G5・HD・PD）と標準体重（SW）から算出します。ステージ不明時は全項目で病院の指示を求めます',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    sources: ['JSN2014'],
  },
  {
    id: 'liver_cirrhosis',
    name: '肝硬変',
    shortName: '肝硬変',
    description:
      '腹水の有無で食塩目安が変化。エネルギーは病院の指示を入力、たんぱく質は昏睡時以外は極端に減らしません',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sources: ['JSGE2023'],
  },
  {
    id: 'chemo_side_effects',
    name: '抗がん剤などの副作用（症状別ケア）',
    shortName: '抗がん剤副作用',
    description:
      '数値制限は置かず、がん情報サービスに基づきレシピの絞り込み（生もの回避含む）と食べやすさのコツを表示します',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    sources: ['GANJOHO'],
  },
  {
    id: 'diet',
    name: 'ダイエット（肥満症ガイドライン準拠）',
    shortName: 'ダイエット',
    description:
      'BMI 25以上の成人に限り標準体重×25kcal以下（BMI 35以上は20〜25kcal）で算出。65歳以上・持病合併時・BMI 25未満は安全のため減量計算を行いません',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    sources: ['JASSO2022', 'DRI2025'],
  },
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  disclaimerAccepted: false,
  disclaimerAcceptedAt: null,
  servings: 2,
  age: 40,
  sex: 'male',
  heightCm: 170,
  weightKg: 65,
  activity: 'normal',
  selectedConditions: ['standard'],
  ckdStage: 'unknown',
  cirrhosisAscites: 'unknown',
  chemoSymptoms: [],
  avoidRawFood: false,
  instructions: {},
  mealRatios: {
    breakfast: 30,
    lunch: 35,
    dinner: 35,
  },
  familyMembers: [],
  doctorTargetsLocked: false,
  doctorNote: '',
  geminiApiKey: '',
  generationMode: 'rule',
  fontSize: 'normal',
};

export function profileToNutritionInput(profile: UserProfile): PersonNutritionInput {
  return {
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activity: profile.activity,
    conditions: profile.selectedConditions,
    ckdStage: profile.ckdStage,
    cirrhosisAscites: profile.cirrhosisAscites,
    chemoSymptoms: profile.chemoSymptoms,
    avoidRawFood: profile.avoidRawFood,
    instructions: profile.instructions,
  };
}

export function familyMemberToNutritionInput(
  member: FamilyMemberProfile
): PersonNutritionInput {
  return {
    age: member.age,
    sex: member.sex,
    heightCm: member.heightCm,
    weightKg: member.weightKg,
    activity: member.activity,
    conditions: member.selectedConditions,
    ckdStage: member.ckdStage,
    cirrhosisAscites: member.cirrhosisAscites,
    instructions: member.instructions,
  };
}

export function getConditionMeta(id: ConditionId): ConditionMeta {
  return CONDITIONS.find((c) => c.id === id) ?? CONDITIONS[0];
}

export function getChemoGuidanceMeta(id: ChemoSymptomKey) {
  return D13_CHEMO_GUIDANCE.find((g) => g.id === id);
}
