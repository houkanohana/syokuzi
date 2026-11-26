/**
 * 文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成
 * すべての栄養値は添付の元データ（src/data/foods.json）から直接読み込み、手入力・推測値を排除する。
 * Tr（微量）と (0) は 0、-（未測定）は null として保持する。
 */
import rawFoodsJson from './foods.json';

export const FOOD_COMPOSITION_SOURCE_LABEL =
  '文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成';

export const FOOD_COMPOSITION_SOURCE_URL =
  'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html';

export interface FoodSafetyFlags {
  rawMeatFish?: boolean;
  rawVeg?: boolean;
  fermented?: boolean; // 非加熱の発酵食品（納豆・キムチ・ヨーグルト等）
  heatedFermented?: boolean; // 加熱して使う発酵調味料（みそ等）
  driedFruit?: boolean;
}

export interface RawFoodPer100g {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carb: number | null;
  fiber: number | null;
  salt: number | null;
  potassium: number | null;
  phosphorus: number | null;
  water: number | null;
}

export interface RawFoodEntry {
  id: string; // 日本食品標準成分表（八訂）食品番号
  name: string;
  kana: string;
  category: string;
  storage: string;
  official: string;
  refuse: number;
  per100g: RawFoodPer100g;
}

export interface FoodCompositionItem extends RawFoodEntry {
  aliases: string[];
  flags: FoodSafetyFlags;
  verifiedFromMextExcel: boolean;
}

// 食品番号ベースの安全フラグ定義（GANJOHO生もの・発酵食品・ドライフルーツ判定用）
const SAFETY_FLAGS_BY_ID: Record<string, FoodSafetyFlags> = {
  // 生魚・刺身想定（加熱前提の切身と区別しつつ、生食されやすいもの）
  '10253': { rawMeatFish: true }, // まぐろ（赤身）
  '10086': { rawMeatFish: true }, // かつお
  '10202': { rawMeatFish: true }, // たらこ（生）
  // 生野菜として食べることが多いもの
  '06312': { rawVeg: true }, // レタス
  '06315': { rawVeg: true }, // サニーレタス
  '06065': { rawVeg: true }, // きゅうり
  '06182': { rawVeg: true }, // トマト
  '06183': { rawVeg: true }, // ミニトマト
  '06128': { rawVeg: true }, // かいわれ大根
  '06319': { rawVeg: true }, // ルッコラ
  // 非加熱発酵食品
  '04046': { fermented: true }, // 納豆
  '06236': { fermented: true }, // キムチ
  '06068': { fermented: true }, // きゅうりのぬか漬け
  '13025': { fermented: true }, // プレーンヨーグルト
  '13026': { fermented: true }, // ヨーグルト（加糖）
  '13027': { fermented: true }, // 飲むヨーグルト
  // 加熱発酵食品（みそ等）
  '17045': { heatedFermented: true },
  '17046': { heatedFermented: true },
  '17044': { heatedFermented: true },
  '17145': { heatedFermented: true },
  // ドライフルーツ
  '07117': { driedFruit: true }, // 干しぶどう
};

// 安全な表記ゆれエイリアス（塩分差が大きい曖昧語はここに入れず、AMBIGUOUS_FOOD_GROUPS側で要確認にする）
const EXTRA_ALIASES_BY_ID: Record<string, string[]> = {
  '01088': ['白米', 'ごはん', 'ご飯', '精白米（ごはん）', '白ご飯'],
  '01093': ['全がゆ', 'お粥', '白がゆ'],
  '01039': ['冷凍うどん', 'ゆでうどん', '茹でうどん'],
  '02034': ['かたくりこ', 'カタクリ粉', 'でん粉'],
  '04033': ['絹豆腐', '絹ごし'],
  '04032': ['もめん豆腐'],
  '06061': ['キャベツ（生）', 'キャベツ（生・千切り）'],
  '06233': ['白菜（生）'],
  '06153': ['玉葱', 'タマネギ', '玉ねぎ（生）'],
  '06214': ['人参', 'ニンジン', 'にんじん（生）'],
  '06103': ['生姜', 'ショウガ', 'しょうが（生）'],
  '06263': ['冷凍ブロッコリー', 'ブロッコリー（ゆで）', 'ゆでブロッコリー'],
  '08016': ['ぶなしめじ', 'きのこ（しめじ等）'],
  '10134': ['生鮭切り身', '生さけ', 'しろさけ（生）'],
  '10139': ['塩ざけ', '甘塩鮭', '塩シャケ'],
  '10205': ['白身魚', '白身魚（生たら等）', '生たら', '生鱈', 'まだら（生）'],
  '11115': ['豚こま肉', '豚こま', '豚小間切れ', '豚切り落とし'],
  '11220': ['鶏むね肉（皮なし）', '鶏胸肉（皮なし）', 'とりむね皮なし'],
  '11219': ['鶏むね肉（皮つき）', '鶏胸肉（皮つき）'],
  '11224': ['鶏もも肉（皮なし）', '鶏もも皮なし'],
  '11221': ['鶏もも肉（皮つき）'],
  '11227': ['鶏ささみ', 'ササミ'],
  '12004': ['鶏卵', '鶏卵（全卵）', '玉子', '生卵'],
  '14006': ['植物油', '調合油', '油'],
  '14001': ['オリーブオイル'],
  '17007': ['濃口醤油', 'こいくち醤油', '濃口しょうゆ', 'こいくちしょうゆ'],
  '17086': ['減塩醤油', '減塩しょう油'],
  '17008': ['薄口醤油', '薄口しょうゆ'],
  '17021': [
    'だし汁',
    '無塩だし汁',
    'だしパック（無塩だし汁）',
    'だしパック（冷やしだし）',
    '一番だし',
    'かつお・こんぶだし',
  ],
  '17012': ['食塩'],
  '17045': ['米みそ（淡色辛みそ）', '淡色辛みそ'],
  '17046': ['赤色辛みそ'],
  '17044': ['甘みそ'],
  '17145': ['減塩味噌'],
  '17029': ['めんつゆストレート'],
  '17030': ['めんつゆ三倍濃縮', 'めんつゆ3倍濃縮'],
};

const typedRaw = rawFoodsJson as {
  source: string;
  note: string;
  foods: RawFoodEntry[];
};

export const FOOD_COMPOSITION_MASTER: FoodCompositionItem[] = typedRaw.foods.map(
  (entry) => {
    const kanaTokens = entry.kana
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const extra = EXTRA_ALIASES_BY_ID[entry.id] ?? [];
    const aliases = Array.from(new Set([entry.name, entry.official, ...kanaTokens, ...extra]));
    return {
      ...entry,
      aliases,
      flags: SAFETY_FLAGS_BY_ID[entry.id] ?? {},
      verifiedFromMextExcel: true,
    };
  }
);

export const FOOD_COMPOSITION_BY_ID: Record<string, FoodCompositionItem> =
  Object.fromEntries(FOOD_COMPOSITION_MASTER.map((item) => [item.id, item]));
