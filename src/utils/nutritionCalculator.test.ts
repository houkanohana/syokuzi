import { describe, expect, it } from 'vitest';
import {
  FOOD_COMPOSITION_BY_ID,
  FOOD_COMPOSITION_MASTER,
  FOOD_COMPOSITION_SOURCE_LABEL,
} from '../data/foodComposition';
import { RECIPE_DATABASE } from '../data/recipes';
import { calculateDailyTargets, compareMealWithTarget } from '../nutrition/calculator';
import {
  BOIL_DRAIN_NO_DEDUCTION_NOTICE,
  calculateDishNutrition,
  findFoodComposition,
  resolveFoodComposition,
  searchFoodComposition,
} from './nutritionCalculator';

describe('日本食品標準成分表（八訂）増補2023年 栄養計算エンジン・安全のきまり', () => {
  it('元データ foods.json の305品目が欠損なく読み込まれ、出典文言が定義されている', () => {
    expect(FOOD_COMPOSITION_MASTER.length).toBe(305);
    expect(FOOD_COMPOSITION_SOURCE_LABEL).toBe(
      '文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成'
    );
    expect(FOOD_COMPOSITION_MASTER.every((f) => f.verifiedFromMextExcel)).toBe(true);
  });

  it('【指定テスト】元データ foods.json の代表4品目の数値が正確である（可食部100gあたり）', () => {
    // 卵（12004）：142kcal・食塩0.4g
    const egg = FOOD_COMPOSITION_BY_ID['12004'];
    expect(egg).toBeDefined();
    expect(egg.per100g.kcal).toBe(142);
    expect(egg.per100g.salt).toBe(0.4);

    // しょうゆ（こいくち）（17007）：食塩14.5g・カリウム390mg
    const soy = FOOD_COMPOSITION_BY_ID['17007'];
    expect(soy).toBeDefined();
    expect(soy.per100g.salt).toBe(14.5);
    expect(soy.per100g.potassium).toBe(390);

    // ほうれん草（06267）：カリウム690mg
    const spinach = FOOD_COMPOSITION_BY_ID['06267'];
    expect(spinach).toBeDefined();
    expect(spinach.per100g.potassium).toBe(690);

    // ごはん（白米）（01088）：156kcal
    const rice = FOOD_COMPOSITION_BY_ID['01088'];
    expect(rice).toBeDefined();
    expect(rice.per100g.kcal).toBe(156);
  });

  it('未測定（null）の栄養素は0として足さず exactNutrition=null・missingMeasurementNutrients として扱う', () => {
    // 17021 かつお昆布だし は food.per100g.fiber が null（未測定）
    expect(FOOD_COMPOSITION_BY_ID['17021'].per100g.fiber).toBeNull();

    const res = calculateDishNutrition([
      { name: 'ごはん（白米）', foodId: '01088', grams: 150 },
      { name: 'かつお昆布だし', foodId: '17021', grams: 200 },
    ]);

    expect(res.exactNutrition.fiber).toBeNull();
    expect(res.missingMeasurementNutrients).toContain('fiber');
    // 測定済みのエネルギーは正確に計算される（ごはん156*1.5 + かつお昆布だし2*2 = 238kcal）
    expect(FOOD_COMPOSITION_BY_ID['17021'].per100g.kcal).toBe(2);
    expect(res.exactNutrition.energy).toBe(238);

    // null の栄養素を 1食目安比較へ渡すと「計算が不確か（データなし）」になる
    const daily = calculateDailyTargets({
      age: 40,
      sex: 'male',
      heightCm: 170,
      weightKg: 65,
      activity: 'normal',
      conditions: ['standard'],
    });
    const cmp = compareMealWithTarget('fiber', daily.targets.fiber, res.exactNutrition.fiber, 35, 'g');
    expect(cmp.status).toBe('uncertain');
    expect(cmp.message).toContain('データなし');
  });

  it('【安全ルール2】ゆでこぼし・水さらしで固定割合を勝手に引かず、生の値＋注意文を出す', () => {
    const rawSpinach = calculateDishNutrition([
      { name: 'ほうれん草', foodId: '06267', grams: 100 },
    ]);
    const boilDrainSpinach = calculateDishNutrition([
      { name: 'ほうれん草', foodId: '06267', grams: 100, prepTags: ['boil_drain'] },
    ]);

    // 勝手な30%減を行わない（690mgのまま）
    expect(rawSpinach.exactNutrition.potassium).toBe(690);
    expect(boilDrainSpinach.exactNutrition.potassium).toBe(690);
    expect(boilDrainSpinach.prepNotices).toContain(BOIL_DRAIN_NO_DEDUCTION_NOTICE);
  });

  it('【安全ルール2】成分表のゆで項目と重量変化率が両方そろっている場合のみゆで項目で計算する', () => {
    // テスト用：明示的に boiledFoodId（01039 ゆでうどん等）と weightChangeRate を両方指定した場合のみ変換される
    const converted = calculateDishNutrition([
      {
        name: 'ほうれん草',
        foodId: '06267',
        grams: 100,
        prepTags: ['boil_drain'],
        officialBoiledConversion: {
          boiledFoodId: '06150', // たけのこ（ゆで）を仮のゆで済み項目IDとして検証
          weightChangeRate: 0.9,
        },
      },
    ]);
    expect(converted.matchedItems[0].usedBoiledConversion).toBe(true);
    expect(converted.matchedItems[0].grams).toBe(90);
    expect(converted.prepNotices).not.toContain(BOIL_DRAIN_NO_DEDUCTION_NOTICE);
  });

  it('【安全ルール3】塩分差が大きい曖昧な食材名は自動で片方を選ばず ambiguous（要確認）にする', () => {
    const ambiguousNames = [
      '鮭',
      'しょうゆ',
      'みそ',
      '梅干し',
      '漬物',
      'ハム',
      'めんつゆ',
      'ツナ缶',
      'さば缶',
      'ドレッシング',
      'ソース',
      'のり',
      '豆腐',
      '鶏むね肉',
      '鶏もも肉',
    ];
    for (const name of ambiguousNames) {
      const resolved = resolveFoodComposition(name);
      expect(resolved.status, `${name} は ambiguous であるべき`).toBe('ambiguous');
      expect(findFoodComposition(name)).toBeNull();
    }
  });

  it('【安全ルール3】具体的な食材名は一意に成分表マスターへ照合できる', () => {
    expect(findFoodComposition('生鮭')?.id).toBe('10134');
    expect(findFoodComposition('塩鮭')?.id).toBe('10139');
    expect(findFoodComposition('しょうゆ（こいくち）')?.id).toBe('17007');
    expect(findFoodComposition('濃口醤油')?.id).toBe('17007');
    expect(findFoodComposition('減塩しょうゆ')?.id).toBe('17086');
    expect(findFoodComposition('うすくちしょうゆ')?.id).toBe('17008');
    expect(findFoodComposition('めんつゆ（3倍濃縮）')?.id).toBe('17030');
    expect(findFoodComposition('めんつゆ（ストレート）')?.id).toBe('17029');
    expect(findFoodComposition('鶏むね肉（皮なし）')?.id).toBe('11220');
    expect(findFoodComposition('タマネギ')?.id).toBe('06153');
    expect(findFoodComposition('ニンジン')?.id).toBe('06214');
  });

  it('【安全ルール4】AI出力チェック：未照合・曖昧・塩分調味料なし・おかしなグラム数で要確認＆計算が不確かになる', () => {
    // 1. 曖昧食材（しょうゆ）を含む場合
    const ambigRes = calculateDishNutrition(
      [
        { name: '鶏むね肉（皮なし）', grams: 100 },
        { name: 'しょうゆ', grams: 6 },
      ],
      { checkSaltySeasoning: true }
    );
    expect(ambigRes.ambiguousIngredients.length).toBe(1);
    expect(ambigRes.needsVerification).toBe(true);

    // 2. 未登録食材を含む場合
    const unmatchedRes = calculateDishNutrition(
      [
        { name: '絹ごし豆腐', grams: 100 },
        { name: '減塩しょうゆ', grams: 6 },
        { name: '謎の特製スパイスX', grams: 5 },
      ],
      { checkSaltySeasoning: true }
    );
    expect(unmatchedRes.unmatchedIngredients).toEqual(['謎の特製スパイスX']);
    expect(unmatchedRes.needsVerification).toBe(true);

    // 3. 塩分のある調味料が1つも入っていない場合
    const noSaltRes = calculateDishNutrition(
      [
        { name: 'ごはん（白米）', grams: 150 },
        { name: '鶏むね肉（皮なし）', grams: 100 },
        { name: 'にんじん', grams: 40 },
      ],
      { checkSaltySeasoning: true }
    );
    expect(noSaltRes.missingSaltySeasoning).toBe(true);
    expect(noSaltRes.needsVerification).toBe(true);

    // 4. グラム数が0以下または1000g超の場合
    const badGramRes = calculateDishNutrition(
      [
        { name: 'ごはん（白米）', grams: 1500 },
        { name: '減塩しょうゆ', grams: 0 },
      ],
      { checkSaltySeasoning: true }
    );
    expect(badGramRes.invalidGramIngredients.length).toBe(2);
    expect(badGramRes.needsVerification).toBe(true);

    // 要確認の料理を1食比較へ渡すと「計算が不確か」になる
    const daily = calculateDailyTargets({
      age: 60,
      sex: 'male',
      heightCm: 170,
      weightKg: 65,
      activity: 'normal',
      conditions: ['hypertension'],
    });
    const cmp = compareMealWithTarget(
      'salt',
      daily.targets.salt,
      ambigRes.exactNutrition.salt,
      35,
      'g',
      { isUncertain: ambigRes.needsVerification }
    );
    expect(cmp.status).toBe('uncertain');
    expect(cmp.message).toBe('計算が不確か');
  });

  it('生もの・非加熱発酵食品・ドライフルーツの安全フラグを食品番号から自動検出する', () => {
    const res = calculateDishNutrition([
      { name: 'まぐろ（赤身）', foodId: '10253', grams: 50 },
      { name: '納豆', foodId: '04046', grams: 45 },
      { name: '干しぶどう', foodId: '07117', grams: 15 },
    ]);

    expect(res.detectedFlags.rawMeatFish).toBe(true);
    expect(res.detectedFlags.fermented).toBe(true);
    expect(res.detectedFlags.driedFruit).toBe(true);
  });

  it('食材検索ヘルパーで日本語・食品番号・かな検索ができる', () => {
    const hits = searchFoodComposition('豆腐', 8);
    expect(hits.some((f) => f.id === '04033')).toBe(true);
    expect(hits.some((f) => f.id === '04032')).toBe(true);

    const byId = searchFoodComposition('17007', 5);
    expect(byId[0]?.id).toBe('17007');
  });

  it('内蔵全レシピが foods.json と100%照合し、要確認0件・ゆでこぼし注意文が正しく付与されている', () => {
    expect(RECIPE_DATABASE.length).toBeGreaterThan(0);
    for (const recipe of RECIPE_DATABASE) {
      expect(recipe.unmatchedIngredients, `${recipe.id} unmatched`).toEqual([]);
      expect(recipe.needsVerification, `${recipe.id} needsVerification`).toBe(false);
      expect(recipe.matchedFoodMappings.length, `${recipe.id} mappings`).toBeGreaterThan(0);
      expect(recipe.nutritionPerServing.caloriesKcal).toBeGreaterThan(0);
    }

    // 腎ケアレシピにはゆでこぼし注意文が付与されていること（固定割合で引いていない明示）
    const kidneyBowl = RECIPE_DATABASE.find((r) => r.id === 'low-protein-veggie-ankake-bowl');
    expect(kidneyBowl?.prepNotices).toContain(BOIL_DRAIN_NO_DEDUCTION_NOTICE);
  });
});
