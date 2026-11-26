import { getChemoGuidanceMeta, getConditionMeta, profileToNutritionInput } from '../data/conditions';
import { RECIPE_DATABASE } from '../data/recipes';
import { calculateDailyTargets } from '../nutrition/calculator';
import type {
  CareTip,
  InventoryItem,
  MealIngredientDisplay,
  RecipeDefinition,
  RecipeIngredient,
  SuggestedMeal,
  UserProfile,
} from '../types';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(].*?[)）]/g, '');
}

function findMatchingStock(
  ingredient: RecipeIngredient,
  inventory: InventoryItem[]
): InventoryItem | undefined {
  const keywords = [ingredient.name, ...ingredient.keywords].map(normalizeText);
  return inventory.find((item) => {
    const stockNorm = normalizeText(item.name);
    if (!stockNorm) return false;
    return keywords.some(
      (kw) => kw && (stockNorm.includes(kw) || kw.includes(stockNorm))
    );
  });
}

function formatScaledAmount(ingredient: RecipeIngredient, servings: number): string {
  if (ingredient.amountPerServing === null) {
    return ingredient.displayFallback ?? '適量';
  }
  const scaled = ingredient.amountPerServing * servings;
  const rounded = scaled < 10 ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  if (ingredient.unit === '小さじ' || ingredient.unit === '大さじ') {
    return `${ingredient.unit}${rounded}`;
  }
  return `${rounded}${ingredient.unit}`;
}

function buildCareTips(recipe: RecipeDefinition, profile: UserProfile): CareTip[] {
  const tips: CareTip[] = [];

  for (const condId of profile.selectedConditions) {
    const specific = recipe.conditionSpecificTips?.[condId];
    if (specific) {
      tips.push({
        label: getConditionMeta(condId).shortName,
        tip: specific,
      });
    }
  }

  if (profile.selectedConditions.includes('chemo_side_effects')) {
    for (const symId of profile.chemoSymptoms) {
      const specific = recipe.conditionSpecificTips?.[symId];
      const meta = getChemoGuidanceMeta(symId);
      if (specific && meta) {
        tips.push({
          label: meta.name,
          tip: specific,
        });
      }
    }
  }

  // 加熱した発酵食品の注意（生もの回避時）
  if (profile.avoidRawFood && recipe.flags?.heatedFermented) {
    tips.push({
      label: '発酵食品（加熱）',
      tip: '加熱した発酵食品をとってよいか、医師・管理栄養士に確かめてください。',
    });
  }

  // 嚥下配慮時：段階分けはアプリで自動判定しない旨を明記
  if (
    profile.selectedConditions.includes('chemo_side_effects') &&
    profile.chemoSymptoms.includes('dysphagia')
  ) {
    tips.push({
      label: '嚥下配慮',
      tip: '嚥下調整食の段階分けはアプリでは自動判定しません。食形態は必ず医師・言語聴覚士・管理栄養士の指示に従ってください。',
    });
  }

  for (const base of recipe.baseTips) {
    tips.push({
      label: '調理のコツ',
      tip: base,
    });
  }

  return tips.slice(0, 5);
}

function buildMatchReason(
  recipe: RecipeDefinition,
  profile: UserProfile,
  stockMatchRate: number,
  availableCount: number,
  totalCount: number
): string {
  const reasons: string[] = [];

  if (stockMatchRate >= 0.8) {
    reasons.push(`ご自宅の在庫がほぼ揃っています（${availableCount}/${totalCount}品）`);
  } else if (availableCount > 0) {
    reasons.push(`自宅の在庫 ${availableCount}/${totalCount}品 を活用できます`);
  }

  const matchedConds = profile.selectedConditions
    .filter((c) => c !== 'standard' && recipe.suitableConditions.includes(c))
    .map((c) => getConditionMeta(c).shortName);

  if (matchedConds.length > 0) {
    reasons.push(`${matchedConds.slice(0, 2).join('・')}に配慮`);
  }

  if (
    profile.selectedConditions.includes('chemo_side_effects') &&
    profile.chemoSymptoms.includes('dysphagia') &&
    recipe.flags?.soft
  ) {
    reasons.push('やわらか印');
  }

  return reasons.slice(0, 2).join(' ／ ') || 'バランス良く作りやすいおすすめ献立です';
}

export function generateRuleBasedSuggestions(
  profile: UserProfile,
  inventory: InventoryItem[],
  variationOffset = 0
): SuggestedMeal[] {
  const dailyResult = calculateDailyTargets(profileToNutritionInput(profile));

  // D13 生もの回避フィルタ：rawMeatFish / rawVeg / fermented（非加熱）/ driedFruit を除外
  const eligibleRecipes = RECIPE_DATABASE.filter((recipe) => {
    if (profile.avoidRawFood && recipe.flags) {
      if (
        recipe.flags.rawMeatFish ||
        recipe.flags.rawVeg ||
        recipe.flags.fermented ||
        recipe.flags.driedFruit
      ) {
        return false;
      }
    }
    return true;
  });

  const scored = eligibleRecipes.map((recipe) => {
    const availableIngredients: MealIngredientDisplay[] = [];
    const missingIngredients: MealIngredientDisplay[] = [];

    let stockBonus = 0;
    for (const ing of recipe.ingredients) {
      const matched = findMatchingStock(ing, inventory);
      const amount = formatScaledAmount(ing, profile.servings);
      if (matched) {
        availableIngredients.push({
          name: ing.name,
          amount,
          matchedStockName: matched.name,
        });
        stockBonus +=
          matched.stockLevel === 'plenty'
            ? 1.15
            : matched.stockLevel === 'half'
              ? 1.0
              : 0.85;
      } else {
        missingIngredients.push({
          name: ing.name,
          amount,
        });
      }
    }

    const totalIngredients = recipe.ingredients.length;
    const stockMatchRate =
      totalIngredients > 0 ? availableIngredients.length / totalIngredients : 0;

    let score = (stockBonus / Math.max(1, totalIngredients)) * 45;

    for (const cond of profile.selectedConditions) {
      if (recipe.suitableConditions.includes(cond)) {
        score += cond === 'standard' ? 10 : 22;
      }
      if (recipe.avoidConditions?.includes(cond)) {
        score -= 38;
      }
    }

    if (profile.selectedConditions.includes('chemo_side_effects')) {
      for (const sym of profile.chemoSymptoms) {
        if (recipe.suitableChemoSymptoms?.includes(sym)) {
          score += 24;
        }
      }
      if (profile.chemoSymptoms.includes('dysphagia') && recipe.flags?.soft) {
        score += 18;
      }
    }

    // 確定した数値目安（1食35%換算）との適合スコア
    const n = recipe.nutritionPerServing;
    const saltTarget = dailyResult.targets.salt;
    if (saltTarget.type === 'range' && saltTarget.max != null) {
      const mealSaltMax = saltTarget.max * 0.35;
      if (n.saltG <= mealSaltMax) score += 12;
      else score -= (n.saltG - mealSaltMax) * 18;
    } else if (saltTarget.type === 'instruction' && (saltTarget.compare === 'lt' || saltTarget.compare === 'le')) {
      const mealSaltMax = saltTarget.value * 0.35;
      if (n.saltG <= mealSaltMax) score += 12;
      else score -= (n.saltG - mealSaltMax) * 18;
    }

    const proteinTarget = dailyResult.targets.protein;
    if (
      profile.selectedConditions.includes('kidney_disease') &&
      proteinTarget.type === 'range' &&
      proteinTarget.max != null
    ) {
      const mealProtMax = proteinTarget.max * 0.35;
      if (n.proteinG <= mealProtMax + 2) score += 20;
      else score -= (n.proteinG - mealProtMax) * 2.5;
    }

    const careTips = buildCareTips(recipe, profile);
    const matchReason = buildMatchReason(
      recipe,
      profile,
      stockMatchRate,
      availableIngredients.length,
      totalIngredients
    );

    const suggestion: SuggestedMeal = {
      id: recipe.id,
      title: recipe.title,
      subtitle: recipe.subtitle,
      category: recipe.category,
      cookTimeMin: recipe.cookTimeMin,
      nutritionPerServing: recipe.nutritionPerServing,
      exactNutrition: recipe.exactNutrition,
      missingMeasurementNutrients: recipe.missingMeasurementNutrients,
      matchedFoodMappings: recipe.matchedFoodMappings,
      nutritionBasisNote:
        '文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成',
      unmatchedIngredients: recipe.unmatchedIngredients,
      needsVerification: recipe.needsVerification,
      verificationReasons: recipe.verificationReasons,
      prepNotices: recipe.prepNotices,
      servings: profile.servings,
      availableIngredients,
      missingIngredients,
      steps: recipe.steps,
      careTips,
      cookingFormTags: dailyResult.cookingFormTags.slice(0, 4),
      flags: recipe.flags,
      matchReason,
      source: 'rule',
      youtubeQuery: `${recipe.title} レシピ`,
      stockMatchRate,
    };

    return { suggestion, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const poolSize = Math.min(scored.length, 9);
  const topPool = scored.slice(0, poolSize);
  const startIndex = (variationOffset * 3) % Math.max(1, poolSize);

  const selected: SuggestedMeal[] = [];
  for (let i = 0; i < Math.min(3, poolSize); i++) {
    selected.push(topPool[(startIndex + i) % poolSize].suggestion);
  }

  return selected;
}

export function buildYouTubeSearchUrl(queryText: string): string {
  const query = encodeURIComponent(
    queryText.includes('レシピ') ? queryText : `${queryText} レシピ`
  );
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex(
        (p) => p === 'embed' || p === 'shorts' || p === 'live'
      );
      if (
        markerIdx >= 0 &&
        parts[markerIdx + 1] &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[markerIdx + 1])
      ) {
        return parts[markerIdx + 1];
      }
    }
    return null;
  } catch {
    return null;
  }
}
