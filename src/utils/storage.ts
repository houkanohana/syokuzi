import { DEFAULT_USER_PROFILE } from '../data/conditions';
import { createSampleInventory } from '../data/sampleInventory';
import { validateMealRatios } from '../nutrition/calculator';
import type {
  ActivityLevel,
  AppBackupData,
  BiologicalSex,
  ChemoSymptomKey,
  CustomVideoMap,
  FlyerEntry,
  InventoryItem,
  MealLogEntry,
  ShoppingItem,
  UserProfile,
  VitalLogEntry,
} from '../types';

const KEYS = {
  profile: 'meal_care_profile_v1',
  inventory: 'meal_care_inventory_v1',
  flyers: 'meal_care_flyers_v1',
  shopping: 'meal_care_shopping_v1',
  mealLogs: 'meal_care_meal_logs_v1',
  vitalLogs: 'meal_care_vital_logs_v1',
  customVideos: 'meal_care_custom_videos_v1',
  stepProgress: 'meal_care_step_progress_v1',
} as const;

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function migrateActivity(val: unknown): ActivityLevel {
  if (val === 'low' || val === 'high' || val === 'normal') return val;
  if (val === 'moderate') return 'normal';
  return 'normal';
}

function migrateSex(val: unknown): BiologicalSex {
  if (val === 'female') return 'female';
  return 'male';
}

function migrateChemoSymptoms(raw: unknown): ChemoSymptomKey[] {
  if (!Array.isArray(raw)) return [];
  const mapped = new Set<ChemoSymptomKey>();
  for (const s of raw) {
    if (
      s === 'stomatitis' ||
      s === 'taste_smell' ||
      s === 'nausea' ||
      s === 'anorexia' ||
      s === 'diarrhea' ||
      s === 'constipation' ||
      s === 'dysphagia'
    ) {
      mapped.add(s);
    } else if (s === 'stomatitis_taste') {
      mapped.add('stomatitis');
      mapped.add('taste_smell');
    } else if (s === 'nausea_anorexia') {
      mapped.add('nausea');
      mapped.add('anorexia');
    } else if (s === 'diarrhea_constipation') {
      mapped.add('diarrhea');
      mapped.add('constipation');
    }
  }
  return Array.from(mapped);
}

function normalizeUserProfile(rawObj: Record<string, unknown>): UserProfile {
  const legacyDiet = rawObj.dietProfile as Record<string, unknown> | undefined;
  const selectedConditions =
    Array.isArray(rawObj.selectedConditions) && rawObj.selectedConditions.length > 0
      ? (rawObj.selectedConditions as UserProfile['selectedConditions'])
      : DEFAULT_USER_PROFILE.selectedConditions;

  const rawRatios = rawObj.mealRatios as UserProfile['mealRatios'] | undefined;
  const mealRatios =
    rawRatios && validateMealRatios(rawRatios).valid
      ? rawRatios
      : DEFAULT_USER_PROFILE.mealRatios;

  return {
    ...DEFAULT_USER_PROFILE,
    disclaimerAccepted: Boolean(rawObj.disclaimerAccepted),
    disclaimerAcceptedAt:
      typeof rawObj.disclaimerAcceptedAt === 'string'
        ? rawObj.disclaimerAcceptedAt
        : null,
    servings:
      typeof rawObj.servings === 'number' && rawObj.servings >= 1 && rawObj.servings <= 6
        ? rawObj.servings
        : DEFAULT_USER_PROFILE.servings,
    age:
      typeof rawObj.age === 'number'
        ? rawObj.age
        : typeof legacyDiet?.age === 'number'
          ? legacyDiet.age
          : DEFAULT_USER_PROFILE.age,
    sex: migrateSex(rawObj.sex ?? legacyDiet?.sex),
    heightCm:
      typeof rawObj.heightCm === 'number'
        ? rawObj.heightCm
        : typeof legacyDiet?.heightCm === 'number'
          ? legacyDiet.heightCm
          : DEFAULT_USER_PROFILE.heightCm,
    weightKg:
      typeof rawObj.weightKg === 'number'
        ? rawObj.weightKg
        : typeof legacyDiet?.weightKg === 'number'
          ? legacyDiet.weightKg
          : DEFAULT_USER_PROFILE.weightKg,
    activity: migrateActivity(rawObj.activity ?? legacyDiet?.activityLevel),
    selectedConditions,
    ckdStage:
      rawObj.ckdStage === 'G1_G2' ||
      rawObj.ckdStage === 'G3a' ||
      rawObj.ckdStage === 'G3b' ||
      rawObj.ckdStage === 'G4_G5' ||
      rawObj.ckdStage === 'HD' ||
      rawObj.ckdStage === 'PD' ||
      rawObj.ckdStage === 'unknown'
        ? rawObj.ckdStage
        : 'unknown',
    cirrhosisAscites:
      rawObj.cirrhosisAscites === 'yes' ||
      rawObj.cirrhosisAscites === 'no' ||
      rawObj.cirrhosisAscites === 'unknown'
        ? rawObj.cirrhosisAscites
        : 'unknown',
    chemoSymptoms: migrateChemoSymptoms(rawObj.chemoSymptoms),
    avoidRawFood: Boolean(rawObj.avoidRawFood),
    instructions:
      rawObj.instructions && typeof rawObj.instructions === 'object'
        ? (rawObj.instructions as UserProfile['instructions'])
        : {},
    mealRatios,
    familyMembers: Array.isArray(rawObj.familyMembers)
      ? (rawObj.familyMembers as UserProfile['familyMembers'])
      : [],
    doctorTargetsLocked: Boolean(rawObj.doctorTargetsLocked),
    doctorNote: typeof rawObj.doctorNote === 'string' ? rawObj.doctorNote : '',
    geminiApiKey: typeof rawObj.geminiApiKey === 'string' ? rawObj.geminiApiKey : '',
    generationMode: rawObj.generationMode === 'gemini' ? 'gemini' : 'rule',
    fontSize: rawObj.fontSize === 'large' ? 'large' : 'normal',
  };
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEYS.profile);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_USER_PROFILE;
    return normalizeUserProfile(parsed);
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function loadInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(KEYS.inventory);
    if (!raw) {
      const sample = createSampleInventory();
      saveInventory(sample);
      return sample;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const sample = createSampleInventory();
      saveInventory(sample);
      return sample;
    }
    return parsed as InventoryItem[];
  } catch {
    return createSampleInventory();
  }
}

export function saveInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(KEYS.inventory, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadFlyers(): FlyerEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.flyers);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlyerEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveFlyers(flyers: FlyerEntry[]): void {
  try {
    localStorage.setItem(KEYS.flyers, JSON.stringify(flyers));
  } catch {
    // ignore
  }
}

export function loadShoppingItems(): ShoppingItem[] {
  try {
    const raw = localStorage.getItem(KEYS.shopping);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ShoppingItem[]) : [];
  } catch {
    return [];
  }
}

export function saveShoppingItems(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(KEYS.shopping, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadMealLogs(): MealLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.mealLogs);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MealLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveMealLogs(logs: MealLogEntry[]): void {
  try {
    localStorage.setItem(KEYS.mealLogs, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

export function loadVitalLogs(): VitalLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.vitalLogs);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VitalLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveVitalLogs(logs: VitalLogEntry[]): void {
  try {
    localStorage.setItem(KEYS.vitalLogs, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

export function loadCustomVideos(): CustomVideoMap {
  try {
    const raw = localStorage.getItem(KEYS.customVideos);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CustomVideoMap) : {};
  } catch {
    return {};
  }
}

export function saveCustomVideos(map: CustomVideoMap): void {
  try {
    localStorage.setItem(KEYS.customVideos, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadStepProgress(): Record<string, boolean[]> {
  try {
    const raw = localStorage.getItem(KEYS.stepProgress);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, boolean[]>)
      : {};
  } catch {
    return {};
  }
}

export function saveStepProgress(progress: Record<string, boolean[]>): void {
  try {
    localStorage.setItem(KEYS.stepProgress, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function createBackupPayload(data: {
  profile: UserProfile;
  inventory: InventoryItem[];
  flyers: FlyerEntry[];
  shoppingItems: ShoppingItem[];
  mealLogs: MealLogEntry[];
  vitalLogs: VitalLogEntry[];
  customVideos: CustomVideoMap;
}): AppBackupData {
  return {
    appName: 'ouchi-kondate-care',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

export function parseBackupJson(rawText: string): AppBackupData {
  const parsed = JSON.parse(rawText) as Partial<AppBackupData>;
  if (!parsed || typeof parsed !== 'object' || !parsed.profile) {
    throw new Error('有効なおうち献立ケアのバックアップJSONファイルではありません。');
  }

  return {
    appName: parsed.appName ?? 'ouchi-kondate-care',
    schemaVersion: parsed.schemaVersion ?? 3,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    profile: normalizeUserProfile(parsed.profile as unknown as Record<string, unknown>),
    inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
    flyers: Array.isArray(parsed.flyers) ? parsed.flyers : [],
    shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : [],
    mealLogs: Array.isArray(parsed.mealLogs) ? parsed.mealLogs : [],
    vitalLogs: Array.isArray(parsed.vitalLogs) ? parsed.vitalLogs : [],
    customVideos:
      parsed.customVideos && typeof parsed.customVideos === 'object'
        ? parsed.customVideos
        : {},
  };
}
