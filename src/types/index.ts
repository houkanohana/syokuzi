import type {
  DoctorInstruction,
  InstructionCompare,
  MealPeriod,
  MealRatios,
  MedicalConditionId,
} from '../nutrition/calculator';
import type {
  ActivityLevel,
  BiologicalSex,
  ChemoSymptomKey,
  CirrhosisAscitesStatus,
  CkdStage,
  NutrientKey,
  SourceId,
} from '../nutrition/referenceData';
import type {
  DishIngredientInput,
  NullableRecipeNutrition,
  PrepMethodTag,
} from '../utils/nutritionCalculator';

export type { DishIngredientInput, NullableRecipeNutrition, PrepMethodTag };

export type {
  ActivityLevel,
  BiologicalSex,
  ChemoSymptomKey,
  CirrhosisAscitesStatus,
  CkdStage,
  DoctorInstruction,
  InstructionCompare,
  MealPeriod,
  MealRatios,
  MedicalConditionId,
  NutrientKey,
  SourceId,
};

export type ConditionId = MedicalConditionId;

export type FontSizeMode = 'normal' | 'large';

export interface FamilyMemberProfile {
  id: string;
  name: string;
  age: number | null;
  sex: BiologicalSex;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel;
  selectedConditions: ConditionId[];
  ckdStage: CkdStage;
  cirrhosisAscites: CirrhosisAscitesStatus;
  instructions: Partial<Record<NutrientKey, DoctorInstruction>>;
}

export interface UserProfile {
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt: string | null;
  servings: number;
  age: number | null;
  sex: BiologicalSex;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel;
  selectedConditions: ConditionId[];
  ckdStage: CkdStage;
  cirrhosisAscites: CirrhosisAscitesStatus;
  chemoSymptoms: ChemoSymptomKey[];
  avoidRawFood: boolean;
  instructions: Partial<Record<NutrientKey, DoctorInstruction>>;
  mealRatios: MealRatios;
  familyMembers: FamilyMemberProfile[];
  doctorTargetsLocked: boolean;
  doctorNote: string;
  geminiApiKey: string;
  generationMode: 'rule' | 'gemini';
  fontSize: FontSizeMode;
}

export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export type StockLevel = 'plenty' | 'half' | 'low';

export interface InventoryItem {
  id: string;
  name: string;
  location: StorageLocation;
  quantityText: string;
  stockLevel: StockLevel;
  updatedAt: string;
}

export interface RecipeIngredient {
  name: string;
  keywords: string[];
  amountPerServing: number | null;
  unit: string;
  displayFallback?: string;
}

export interface RecipeNutrition {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  saltG: number;
  potassiumMg: number;
  phosphorusMg: number;
  fluidMl: number;
}

export interface RecipeFlags {
  rawMeatFish?: boolean;
  rawVeg?: boolean;
  fermented?: boolean; // 加熱しない発酵食品（納豆・キムチ・生みそ和え等）
  heatedFermented?: boolean; // 加熱した発酵食品（みそ汁等）
  driedFruit?: boolean;
  soft?: boolean; // やわらか調理の印
}

export interface CareTip {
  label: string;
  tip: string;
}

export interface MatchedFoodMappingDisplay {
  inputName: string;
  foodId: string;
  name: string;
  official: string;
  grams: number;
}

export interface RecipeDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  cookTimeMin: number;
  /** 日本食品標準成分表（八訂）元データ（foods.json）から自動計算するための1人分食材リスト */
  foodItems: DishIngredientInput[];
  nutritionPerServing: RecipeNutrition;
  exactNutrition: NullableRecipeNutrition;
  missingMeasurementNutrients: NutrientKey[];
  matchedFoodMappings: MatchedFoodMappingDisplay[];
  unmatchedIngredients: string[];
  needsVerification: boolean;
  verificationReasons: string[];
  prepNotices: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  suitableConditions: ConditionId[];
  suitableChemoSymptoms?: ChemoSymptomKey[];
  avoidConditions?: ConditionId[];
  flags?: RecipeFlags;
  baseTips: string[];
  conditionSpecificTips?: Partial<Record<ConditionId | ChemoSymptomKey, string>>;
}

export interface MealIngredientDisplay {
  name: string;
  amount: string;
  matchedStockName?: string;
}

export interface SuggestedMeal {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  cookTimeMin: number;
  nutritionPerServing: RecipeNutrition;
  exactNutrition: NullableRecipeNutrition;
  missingMeasurementNutrients: NutrientKey[];
  matchedFoodMappings: MatchedFoodMappingDisplay[];
  nutritionBasisNote: string;
  unmatchedIngredients: string[];
  needsVerification: boolean;
  verificationReasons: string[];
  prepNotices: string[];
  servings: number;
  availableIngredients: MealIngredientDisplay[];
  missingIngredients: MealIngredientDisplay[];
  steps: string[];
  careTips: CareTip[];
  cookingFormTags: string[];
  flags?: RecipeFlags;
  matchReason: string;
  source: 'rule' | 'gemini';
  youtubeQuery: string;
  stockMatchRate: number;
}

export interface FlyerDealItem {
  id: string;
  name: string;
  priceText: string;
  note?: string;
}

export interface FlyerEntry {
  id: string;
  storeName: string;
  sourceType: 'image_ai' | 'text_memo' | 'sample';
  memoOrUrl?: string;
  createdAt: string;
  items: FlyerDealItem[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  checked: boolean;
  sourceMealTitle?: string;
  matchedStoreName?: string;
  matchedPriceText?: string;
  matchedDealName?: string;
  isManual?: boolean;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  slot: MealSlot;
  title: string;
  portionRatio: number;
  nutrition: RecipeNutrition;
  recipeId?: string;
}

export type EdemaLevel = 'none' | 'mild' | 'moderate';

export interface VitalLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  recordedAt: string;
  weightKg?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  fluidIntakeMl?: number | null;
  edema: EdemaLevel;
  conditionMemo: string;
}

export interface CustomVideoMap {
  [key: string]: {
    url: string;
    title?: string;
  };
}

export interface AppBackupData {
  appName: string;
  schemaVersion: number;
  exportedAt: string;
  profile: UserProfile;
  inventory: InventoryItem[];
  flyers: FlyerEntry[];
  shoppingItems: ShoppingItem[];
  mealLogs: MealLogEntry[];
  vitalLogs: VitalLogEntry[];
  customVideos: CustomVideoMap;
}

export type AppTab = 'meals' | 'shopping' | 'inventory' | 'logs' | 'profile';

export type LegalTab = 'disclaimer' | 'terms' | 'privacy';
