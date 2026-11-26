import {
  ACTIVITY_DESCRIPTIONS,
  D1_EER_PER_KG,
  D2_BMR_PER_KG,
  D3_PAL,
  D4_SALT_DG,
  D5_POTASSIUM_DG,
  D6_PROTEIN_RDA,
  D7_FIBER_DG,
  D8_PFC_PERCENT,
  D9_CKD_SPECS,
  D13_CHEMO_GUIDANCE,
  type ActivityLevel,
  type AgeBand,
  type BiologicalSex,
  type ChemoSymptomKey,
  type CirrhosisAscitesStatus,
  type CkdStage,
  type NutrientKey,
  type SourceId,
} from './referenceData';

export type MedicalConditionId =
  | 'standard'
  | 'hypertension'
  | 'diabetes'
  | 'heart_failure'
  | 'kidney_disease'
  | 'liver_cirrhosis'
  | 'chemo_side_effects'
  | 'diet';

export type InstructionCompare = 'lt' | 'le' | 'ge' | 'about';

export interface DoctorInstruction {
  value: number;
  compare: InstructionCompare;
}

export type DailyTargetValue =
  | {
      type: 'range';
      min?: number;
      max?: number;
      maxExclusive?: boolean;
      direction?: 'limit' | 'secure';
      notes: string[];
      sources: SourceId[];
    }
  | {
      type: 'text';
      text: string;
      direction?: 'limit' | 'secure';
      notes: string[];
      sources: SourceId[];
    }
  | {
      type: 'needInstruction';
      messages: string[];
      sources: SourceId[];
    }
  | {
      type: 'missing';
      message: string;
      sources: SourceId[];
    }
  | {
      type: 'instruction';
      value: number;
      compare: InstructionCompare;
      referenceResult: Exclude<DailyTargetValue, { type: 'instruction' }>;
      sources: SourceId[];
    };

export interface PersonNutritionInput {
  age: number | null;
  sex: BiologicalSex;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel;
  conditions: MedicalConditionId[];
  ckdStage?: CkdStage;
  cirrhosisAscites?: CirrhosisAscitesStatus;
  chemoSymptoms?: ChemoSymptomKey[];
  avoidRawFood?: boolean;
  instructions?: Partial<Record<NutrientKey, DoctorInstruction>>;
}

export interface DailyTargetsResult {
  ageBand: AgeBand | null;
  standardWeightKg: number | null;
  bmi: number | null;
  bmrKcal: number | null;
  eerKcal: number | null;
  targets: Record<NutrientKey, DailyTargetValue>;
  notices: string[];
  cookingFormTags: string[];
  symptomTips: { label: string; tip: string }[];
  usedSources: SourceId[];
}

export interface MealRatios {
  breakfast: number; // %
  lunch: number; // %
  dinner: number; // %
}

export type MealPeriod = 'breakfast' | 'lunch' | 'dinner';

export type MealComparisonStatus = 'ok' | 'high' | 'uncompared' | 'uncertain';

export interface MealComparisonItem {
  nutrient: NutrientKey;
  actual: number | null;
  status: MealComparisonStatus;
  mealLimitText: string;
  message: string;
}

type RuleDirection = 'limit' | 'secure';

type NutrientRule =
  | {
      kind: 'num';
      min?: number;
      max?: number;
      maxExclusive?: boolean;
      direction?: RuleDirection;
      source: SourceId;
      note?: string;
    }
  | {
      kind: 'text';
      text: string;
      direction?: RuleDirection;
      suppressBase?: boolean;
      source: SourceId;
      note?: string;
    }
  | {
      kind: 'block';
      message: string;
      source: SourceId;
    }
  | {
      kind: 'prompt';
      message: string;
      source: SourceId;
    }
  | {
      kind: 'missing';
      message: string;
      source: SourceId;
    };

const ALL_NUTRIENTS: NutrientKey[] = [
  'energy',
  'protein',
  'fat',
  'carb',
  'fiber',
  'salt',
  'potassium',
  'phosphorus',
  'water',
];

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

function round10(val: number): number {
  return Math.round(val / 10) * 10;
}

function roundInt(val: number): number {
  return Math.round(val);
}

function roundFloat(val: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(val * factor) / factor;
}

export function getAgeBand(age: number | null): AgeBand | null {
  if (age == null || Number.isNaN(age) || age < 1) return null;
  if (age <= 2) return '1-2';
  if (age <= 5) return '3-5';
  if (age <= 7) return '6-7';
  if (age <= 9) return '8-9';
  if (age <= 11) return '10-11';
  if (age <= 14) return '12-14';
  if (age <= 17) return '15-17';
  if (age <= 29) return '18-29';
  if (age <= 49) return '30-49';
  if (age <= 64) return '50-64';
  if (age <= 74) return '65-74';
  return '75+';
}

export function calculateStandardWeight(heightCm: number | null): number | null {
  if (heightCm == null || Number.isNaN(heightCm) || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return round1(heightM * heightM * 22);
}

export function calculateBmi(
  heightCm: number | null,
  weightKg: number | null
): number | null {
  if (
    heightCm == null ||
    weightKg == null ||
    Number.isNaN(heightCm) ||
    Number.isNaN(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }
  const heightM = heightCm / 100;
  return round1(weightKg / (heightM * heightM));
}

function getActivityIndex(activity: ActivityLevel): 0 | 1 | 2 {
  if (activity === 'low') return 0;
  if (activity === 'high') return 2;
  return 1;
}

function uniqueStrings(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

function uniqueSources(list: SourceId[]): SourceId[] {
  return Array.from(new Set(list));
}

function getProteinPercentRange(age: number): { min: number; max: number } {
  if (age >= 65) return D8_PFC_PERCENT.protein.age65plus;
  if (age >= 50) return D8_PFC_PERCENT.protein.age50to64;
  return D8_PFC_PERCENT.protein.age1to49;
}

function resolveNutrientRules(
  nutrient: NutrientKey,
  rules: NutrientRule[],
  baseTarget: Exclude<DailyTargetValue, { type: 'instruction' }> | null,
  instruction?: DoctorInstruction
): DailyTargetValue {
  const computeCore = (): Exclude<DailyTargetValue, { type: 'instruction' }> => {
    const blocks = rules.filter(
      (r): r is Extract<NutrientRule, { kind: 'block' }> => r.kind === 'block'
    );
    const nums = rules.filter(
      (r): r is Extract<NutrientRule, { kind: 'num' }> => r.kind === 'num'
    );
    const texts = rules.filter(
      (r): r is Extract<NutrientRule, { kind: 'text' }> => r.kind === 'text'
    );
    const prompts = rules.filter(
      (r): r is Extract<NutrientRule, { kind: 'prompt' }> => r.kind === 'prompt'
    );
    const missings = rules.filter(
      (r): r is Extract<NutrientRule, { kind: 'missing' }> => r.kind === 'missing'
    );

    const allRuleSources = uniqueSources(rules.map((r) => r.source));

    // 2. block が1つでもあれば → needInstruction
    if (blocks.length > 0) {
      return {
        type: 'needInstruction',
        messages: uniqueStrings(blocks.map((b) => b.message)),
        sources: uniqueSources(blocks.map((b) => b.source)),
      };
    }

    // 3. たんぱく質だけ：direction "limit"（腎臓病）と "secure"（心不全・肝硬変）が両方あれば → needInstruction
    if (nutrient === 'protein') {
      const directions = new Set<RuleDirection>();
      nums.forEach((r) => {
        if (r.direction) directions.add(r.direction);
      });
      texts.forEach((r) => {
        if (r.direction) directions.add(r.direction);
      });
      if (directions.has('limit') && directions.has('secure')) {
        return {
          type: 'needInstruction',
          messages: [
            '腎臓病では「減らす」、心不全・肝硬変では「減らしすぎない」と、向きが逆になります。病院の指示を入力してください。',
          ],
          sources: allRuleSources,
        };
      }
    }

    // 4. missing があれば → missing
    if (missings.length > 0) {
      return {
        type: 'missing',
        message: uniqueStrings(missings.map((m) => m.message)).join(' / '),
        sources: uniqueSources(missings.map((m) => m.source)),
      };
    }

    // 5. num が1つ以上あれば統合
    if (nums.length > 0) {
      const mins = nums
        .map((n) => n.min)
        .filter((v): v is number => typeof v === 'number');
      const maxRules = nums.filter(
        (n): n is typeof n & { max: number } => typeof n.max === 'number'
      );

      const mergedMin = mins.length > 0 ? Math.max(...mins) : undefined;
      let mergedMax: number | undefined;
      let mergedMaxExclusive = false;

      if (maxRules.length > 0) {
        mergedMax = Math.min(...maxRules.map((r) => r.max));
        // 同じ値なら「未満(maxExclusive)」を優先
        mergedMaxExclusive = maxRules.some(
          (r) => r.max === mergedMax && Boolean(r.maxExclusive)
        );
      }

      if (
        mergedMin !== undefined &&
        mergedMax !== undefined &&
        (mergedMin > mergedMax || (mergedMin === mergedMax && mergedMaxExclusive))
      ) {
        return {
          type: 'needInstruction',
          messages: ['病気どうしの目安が食い違っています。病院の指示を入力してください。'],
          sources: allRuleSources,
        };
      }

      const notes = uniqueStrings([
        ...nums.map((n) => n.note ?? ''),
        ...prompts.map((p) => p.message),
        ...texts.map((t) => (t.note ? `${t.text}（${t.note}）` : t.text)),
      ]);

      const direction = nums.find((n) => n.direction)?.direction;

      return {
        type: 'range',
        min: mergedMin,
        max: mergedMax,
        maxExclusive: mergedMax !== undefined ? mergedMaxExclusive : undefined,
        direction,
        notes,
        sources: allRuleSources,
      };
    }

    // 6. num が無く prompt があれば → needInstruction
    if (prompts.length > 0) {
      return {
        type: 'needInstruction',
        messages: uniqueStrings(prompts.map((p) => p.message)),
        sources: uniqueSources(prompts.map((p) => p.source)),
      };
    }

    const suppressBase = texts.some((t) => t.suppressBase);

    // 7. base（病気なしの国の目安）があれば使い、text は注記として添える
    if (!suppressBase && baseTarget) {
      const extraNotes = uniqueStrings([
        ...texts.map((t) => (t.note ? `${t.text}（${t.note}）` : t.text)),
      ]);
      const mergedSources = uniqueSources([...baseTarget.sources, ...allRuleSources]);

      if (baseTarget.type === 'range') {
        return {
          ...baseTarget,
          notes: uniqueStrings([...baseTarget.notes, ...extraNotes]),
          sources: mergedSources,
        };
      }
      if (baseTarget.type === 'text') {
        return {
          ...baseTarget,
          notes: uniqueStrings([...baseTarget.notes, ...extraNotes]),
          sources: mergedSources,
        };
      }
      return baseTarget;
    }

    // 8. base も無く text だけなら → text。何も無ければ「目安なし」
    if (texts.length > 0) {
      const primary = texts[0];
      const extraNotes = uniqueStrings([
        primary.note ?? '',
        ...texts.slice(1).map((t) => (t.note ? `${t.text}（${t.note}）` : t.text)),
      ]);
      return {
        type: 'text',
        text: primary.text,
        direction: primary.direction,
        notes: extraNotes,
        sources: allRuleSources,
      };
    }

    return {
      type: 'text',
      text: '目安なし',
      notes: [],
      sources: [],
    };
  };

  const computed = computeCore();

  // 1. ユーザーの指示（instruction）があれば最優先
  if (instruction && !Number.isNaN(instruction.value) && instruction.value >= 0) {
    return {
      type: 'instruction',
      value: instruction.value,
      compare: instruction.compare,
      referenceResult: computed,
      sources: computed.sources,
    };
  }

  return computed;
}

export function calculateDailyTargets(
  input: PersonNutritionInput
): DailyTargetsResult {
  const notices: string[] = [];
  const usedSourcesSet = new Set<SourceId>();

  const age = input.age;
  const ageBand = getAgeBand(age);
  const sw = calculateStandardWeight(input.heightCm);
  const bmi = calculateBmi(input.heightCm, input.weightKg);

  const activeConditions = input.conditions.filter((c) => c !== 'standard');
  const hasAnyDisease = activeConditions.length > 0;

  const hasHypertension = activeConditions.includes('hypertension');
  const hasDiabetes = activeConditions.includes('diabetes');
  const hasHeartFailure = activeConditions.includes('heart_failure');
  const hasCkd = activeConditions.includes('kidney_disease');
  const hasLiver = activeConditions.includes('liver_cirrhosis');
  const hasChemo = activeConditions.includes('chemo_side_effects');
  const hasDiet = activeConditions.includes('diet');

  const ckdStage: CkdStage = input.ckdStage ?? 'unknown';
  const cirrhosisAscites: CirrhosisAscitesStatus = input.cirrhosisAscites ?? 'unknown';
  const chemoSymptoms: ChemoSymptomKey[] = input.chemoSymptoms ?? [];

  // D1・D2・D3 計算（EER & BMR）
  let bmrKcal: number | null = null;
  let eerKcal: number | null = null;

  if (ageBand && input.weightKg != null && input.weightKg > 0) {
    bmrKcal = round10(D2_BMR_PER_KG[input.sex][ageBand] * input.weightKg);
    const actIdx = getActivityIndex(input.activity);
    const eerPerKgTable = D1_EER_PER_KG[input.sex][ageBand];
    let eerPerKg = eerPerKgTable[actIdx];

    if (eerPerKg == null) {
      eerPerKg = eerPerKgTable[1]; // normal で計算
      const actLabel = ACTIVITY_DESCRIPTIONS[input.activity].label;
      notices.push(
        `${ageBand}歳区分には活動量「${actLabel}」の基準表がないため、「ふつう（II）」で計算しています（DRI2025）。`
      );
    }
    eerKcal = round10(eerPerKg * input.weightKg);
    // D3参照確認（成人確認用）
    void D3_PAL[ageBand];
  } else if (age != null && age < 1) {
    notices.push('0歳のお子さんは基準表の対象外です。主治医の指示をご確認ください。');
  }

  // 各栄養素のルール配列
  const rulesByNutrient: Record<NutrientKey, NutrientRule[]> = {
    energy: [],
    protein: [],
    fat: [],
    carb: [],
    fiber: [],
    salt: [],
    potassium: [],
    phosphorus: [],
    water: [],
  };

  // 安全のきまり6：18歳未満で病気・状態を1つでも選んでいる場合、病気のきまりはすべて block
  const isChildWithCondition = age != null && age < 18 && hasAnyDisease;
  if (isChildWithCondition) {
    notices.push(
      '18歳未満のお子さんが病気・状態を選んだ場合、大人向け基準のため自動計算は行いません。主治医の指示を入力してください。'
    );
    for (const k of ALL_NUTRIENTS) {
      rulesByNutrient[k].push({
        kind: 'block',
        message: 'お子さんの病気の目安は、主治医の指示を入力してください。',
        source: 'DRI2025',
      });
    }
  } else {
    // --- 高血圧（D10） ---
    if (hasHypertension) {
      rulesByNutrient.salt.push({
        kind: 'num',
        max: 6,
        maxExclusive: true,
        direction: 'limit',
        source: 'JSH',
      });
    }

    // --- 糖尿病（D10） ---
    if (hasDiabetes) {
      rulesByNutrient.energy.push({
        kind: 'block',
        message: '糖尿病のカロリーは、病院の指示を入力してください。',
        source: 'JDS2024',
      });
      rulesByNutrient.salt.push({
        kind: 'num',
        max: 6,
        maxExclusive: true,
        direction: 'limit',
        source: 'JSH',
      });
      rulesByNutrient.carb.push({
        kind: 'text',
        text: '割合の数値目標なし（摂取量gを確認）',
        suppressBase: true,
        source: 'JDS2024',
        note: '参考：DRI2025の炭水化物バランス目安は50〜65%（警告には使いません）',
      });
    }

    // --- 心不全（D11） ---
    if (hasHeartFailure) {
      rulesByNutrient.salt.push({
        kind: 'prompt',
        message: '心不全の塩分は、病院の指示を入力してください。',
        source: 'JCS2025',
      });
      rulesByNutrient.water.push({
        kind: 'text',
        text: '制限なし（医師の指示があれば入力）',
        suppressBase: true,
        source: 'JCS2025',
        note: '参考：代償期で1〜1.5L/日の水分制限が弱く推奨される場合がありますが、脱水に注意し医師の指示がある場合のみ入力してください。',
      });

      if (input.weightKg == null || input.weightKg <= 0) {
        rulesByNutrient.protein.push({
          kind: 'missing',
          message: '心不全のたんぱく質目安の計算には体重の入力が必要です。',
          source: 'JCS2025',
        });
      } else if (age != null && age >= 65) {
        rulesByNutrient.protein.push({
          kind: 'num',
          min: roundInt(1.2 * input.weightKg),
          max: roundInt(1.5 * input.weightKg),
          direction: 'secure',
          source: 'JCS2025',
          note: '高齢者（65歳以上）の心不全では1.2〜1.5g/kg/日が目安です（下限は1日合計で判断）。',
        });
      } else {
        rulesByNutrient.protein.push({
          kind: 'num',
          min: roundInt(1.1 * input.weightKg),
          direction: 'secure',
          source: 'JCS2025',
          note: '中等度以上の腎機能障害がない場合の目安（1.1g/kg/日以上・1日合計で判断）。',
        });
      }
    }

    // --- 腎臓病 CKD（D9） ---
    if (hasCkd) {
      if (ckdStage === 'unknown') {
        const msg = '腎臓病のステージ（G1〜G5、透析）を主治医に確かめてください。';
        for (const k of [
          'energy',
          'protein',
          'salt',
          'potassium',
          'phosphorus',
          'water',
        ] as NutrientKey[]) {
          rulesByNutrient[k].push({ kind: 'block', message: msg, source: 'JSN2014' });
        }
      } else {
        const spec = D9_CKD_SPECS[ckdStage];
        if (spec.note) {
          notices.push(spec.note);
        }

        // energy
        if (spec.energyPerSw) {
          if (sw == null) {
            rulesByNutrient.energy.push({
              kind: 'missing',
              message: '腎臓病のエネルギー計算には身長の入力が必要です（標準体重を使用）。',
              source: 'JSN2014',
            });
          } else {
            rulesByNutrient.energy.push({
              kind: 'num',
              min: round10(spec.energyPerSw[0] * sw),
              max: round10(spec.energyPerSw[1] * sw),
              source: 'JSN2014',
            });
          }
        }

        // protein
        if (spec.proteinPerSw) {
          if (sw == null) {
            rulesByNutrient.protein.push({
              kind: 'missing',
              message: '腎臓病のたんぱく質計算には身長の入力が必要です（標準体重を使用）。',
              source: 'JSN2014',
            });
          } else {
            rulesByNutrient.protein.push({
              kind: 'num',
              min: roundInt(spec.proteinPerSw[0] * sw),
              max: roundInt(spec.proteinPerSw[1] * sw),
              direction: 'limit',
              source: 'JSN2014',
              note: 'より厳格なたんぱく質制限は専門医・管理栄養士の継続指導が不可欠です。',
            });
          }
        } else if (spec.proteinText) {
          rulesByNutrient.protein.push({
            kind: 'text',
            text: spec.proteinText,
            direction: 'limit',
            suppressBase: true,
            source: 'JSN2014',
          });
        }

        // salt
        if (spec.saltNeedInstruction) {
          rulesByNutrient.salt.push({
            kind: 'block',
            message: spec.saltNeedInstruction,
            source: 'JSN2014',
          });
        } else if (spec.saltMax != null) {
          rulesByNutrient.salt.push({
            kind: 'num',
            min: spec.saltMin,
            max: spec.saltMax,
            maxExclusive: spec.saltMaxExclusive,
            direction: 'limit',
            source: 'JSN2014',
            note:
              spec.saltMin != null
                ? '3g未満の過度の減塩は推奨されていません。'
                : undefined,
          });
        }

        // potassium
        if (spec.potassiumMax != null) {
          rulesByNutrient.potassium.push({
            kind: 'num',
            max: spec.potassiumMax,
            direction: 'limit',
            source: 'JSN2014',
          });
        } else if (spec.potassiumText) {
          rulesByNutrient.potassium.push({
            kind: 'text',
            text: spec.potassiumText,
            suppressBase: true,
            source: 'JSN2014',
            note:
              ckdStage === 'PD'
                ? '高カリウム血症がある場合は血液透析と同様（2,000mg以下）です。'
                : undefined,
          });
        }

        // water
        if (spec.waterNeedInstruction) {
          rulesByNutrient.water.push({
            kind: 'block',
            message: spec.waterNeedInstruction,
            source: 'JSN2014',
          });
        }

        // phosphorus (非透析はここで確定、HD/PDはたんぱく質確定後に計算)
        if (spec.phosphorusFormula === 'none_text') {
          rulesByNutrient.phosphorus.push({
            kind: 'text',
            text: '数値の目安なし（たんぱく質の量と血液検査で判断）',
            suppressBase: true,
            source: 'JSN2014',
          });
        }
      }
    }

    // --- 肝硬変（D12） ---
    if (hasLiver) {
      notices.push(
        '肝硬変では1日4〜5回に分ける分割食や、就寝前の約200kcalの夜食（LES）が勧められることがあります（JSGE2023）。'
      );

      rulesByNutrient.energy.push({
        kind: 'block',
        message: '肝硬変のエネルギー目安は、病院の指示を入力してください。',
        source: 'JSGE2023',
      });

      rulesByNutrient.protein.push({
        kind: 'text',
        text: '極端に減らさない',
        direction: 'secure',
        suppressBase: true,
        source: 'JSGE2023',
        note: '昏睡時以外は極端な制限をしません。具体的な数値は病院の指示を入力してください。',
      });

      if (cirrhosisAscites === 'yes') {
        rulesByNutrient.salt.push({
          kind: 'num',
          min: 5,
          max: 7,
          direction: 'limit',
          source: 'JSGE2023',
          note: '腹水がある場合（食欲を過度に落とさない程度に5〜7g/日）。',
        });
      } else if (cirrhosisAscites === 'no') {
        rulesByNutrient.salt.push({
          kind: 'text',
          text: '控えめに',
          suppressBase: false,
          source: 'JSGE2023',
        });
      } else {
        rulesByNutrient.salt.push({
          kind: 'prompt',
          message: '腹水があるかどうかで変わります。主治医に確かめてください。',
          source: 'JSGE2023',
        });
      }
    }

    // --- ダイエット（D14） ---
    if (hasDiet) {
      const contraindicatedForDiet =
        (age != null && age >= 65) ||
        hasCkd ||
        hasLiver ||
        hasHeartFailure ||
        hasChemo;

      if (contraindicatedForDiet) {
        notices.push(
          '筋肉が落ちる心配があるため、減量のためのカロリー計算をしません。主治医にご相談ください。'
        );
      } else if (bmi == null || sw == null) {
        rulesByNutrient.energy.push({
          kind: 'missing',
          message: 'ダイエットの目安計算には身長と体重の入力が必要です。',
          source: 'JASSO2022',
        });
      } else if (bmi < 25) {
        notices.push(
          '体重を減らす必要は少ないかもしれません。主治医にご相談ください。'
        );
      } else if (bmi < 35) {
        rulesByNutrient.energy.push({
          kind: 'num',
          max: round10(25 * sw),
          direction: 'limit',
          source: 'JASSO2022',
          note: '目標体重は標準体重（BMI 22）を仮に使用。減量目標は3〜6か月で現体重の3%が目安です。',
        });
      } else {
        rulesByNutrient.energy.push({
          kind: 'num',
          min: round10(20 * sw),
          max: round10(25 * sw),
          direction: 'limit',
          source: 'JASSO2022',
          note: 'BMI 35以上（高度肥満症）は合併症により目標が異なります。600kcal/日以下の超低エネルギー食は扱いません。',
        });
      }
    }
  }

  // --- 病気なしの国の目安（base: D1, D4, D5, D6, D7, D8） ---
  const baseTargets: Partial<
    Record<NutrientKey, Exclude<DailyTargetValue, { type: 'instruction' }>>
  > = {};

  if (ageBand) {
    if (eerKcal != null) {
      baseTargets.energy = {
        type: 'range',
        min: eerKcal,
        max: eerKcal,
        notes: [],
        sources: ['DRI2025'],
      };
    } else {
      baseTargets.energy = {
        type: 'missing',
        message: '推定エネルギー必要量の計算には体重の入力が必要です。',
        sources: ['DRI2025'],
      };
    }

    baseTargets.salt = {
      type: 'range',
      max: D4_SALT_DG[input.sex][ageBand],
      maxExclusive: true,
      direction: 'limit',
      notes: [],
      sources: ['DRI2025'],
    };

    // D5: 腎臓病（CKD）を選んだ人には「多めにとる」目標を出さない
    const potassiumVal = D5_POTASSIUM_DG[input.sex][ageBand];
    if (!hasCkd && potassiumVal != null) {
      baseTargets.potassium = {
        type: 'range',
        min: potassiumVal,
        direction: 'secure',
        notes: [],
        sources: ['DRI2025'],
      };
    }

    // D6 + D8: たんぱく質
    const rdaProtein = D6_PROTEIN_RDA[input.sex][ageBand];
    if (eerKcal != null && age != null) {
      const pct = getProteinPercentRange(age);
      const minPctG = roundInt((eerKcal * pct.min) / 100 / 4);
      const maxPctG = roundInt((eerKcal * pct.max) / 100 / 4);
      baseTargets.protein = {
        type: 'range',
        min: Math.max(rdaProtein, minPctG),
        max: Math.max(rdaProtein, maxPctG),
        direction: 'secure',
        notes: [
          `推奨量${rdaProtein}g/日以上・目標量${pct.min}〜${pct.max}%エネルギー（DRI2025）`,
        ],
        sources: ['DRI2025'],
      };
    } else {
      baseTargets.protein = {
        type: 'range',
        min: rdaProtein,
        direction: 'secure',
        notes: [`推奨量${rdaProtein}g/日以上（DRI2025）`],
        sources: ['DRI2025'],
      };
    }

    // D7: 食物繊維
    const fiberVal = D7_FIBER_DG[input.sex][ageBand];
    if (fiberVal != null) {
      baseTargets.fiber = {
        type: 'range',
        min: fiberVal,
        direction: 'secure',
        notes: [],
        sources: ['DRI2025'],
      };
    }

    // D8: 脂質・炭水化物（必要エネルギーからg換算）
    if (eerKcal != null) {
      baseTargets.fat = {
        type: 'range',
        min: roundInt((eerKcal * D8_PFC_PERCENT.fat.min) / 100 / 9),
        max: roundInt((eerKcal * D8_PFC_PERCENT.fat.max) / 100 / 9),
        notes: ['脂質目標量20〜30%エネルギー（DRI2025）'],
        sources: ['DRI2025'],
      };
      baseTargets.carb = {
        type: 'range',
        min: roundInt((eerKcal * D8_PFC_PERCENT.carb.min) / 100 / 4),
        max: roundInt((eerKcal * D8_PFC_PERCENT.carb.max) / 100 / 4),
        notes: ['炭水化物目標量50〜65%エネルギー（DRI2025）'],
        sources: ['DRI2025'],
      };
    }
  } else {
    baseTargets.energy = {
      type: 'missing',
      message: '年齢（1歳以上）を入力してください。',
      sources: ['DRI2025'],
    };
  }

  // まず phosphorus 以外の全栄養素を確定
  const targets = {} as Record<NutrientKey, DailyTargetValue>;
  for (const key of ALL_NUTRIENTS) {
    if (key === 'phosphorus') continue;
    targets[key] = resolveNutrientRules(
      key,
      rulesByNutrient[key],
      baseTargets[key] ?? null,
      input.instructions?.[key]
    );
  }

  // リン（phosphorus）：HD/PD のときだけ確定済みたんぱく質 × 15 で算出
  if (!isChildWithCondition && hasCkd && (ckdStage === 'HD' || ckdStage === 'PD')) {
    const resolvedProtein = targets.protein;
    let proteinForPhosphorus: number | null = null;
    if (resolvedProtein.type === 'instruction') {
      proteinForPhosphorus = resolvedProtein.value;
    } else if (resolvedProtein.type === 'range' && resolvedProtein.max != null) {
      proteinForPhosphorus = resolvedProtein.max;
    }

    if (proteinForPhosphorus != null) {
      rulesByNutrient.phosphorus.push({
        kind: 'num',
        max: round10(proteinForPhosphorus * 15),
        direction: 'limit',
        source: 'JSN2014',
        note: `たんぱく質（${proteinForPhosphorus}g）×15mg以下で算出`,
      });
    } else {
      rulesByNutrient.phosphorus.push({
        kind: 'block',
        message: 'たんぱく質の目安が決まっていないため、リンの目安は病院の指示を入力してください。',
        source: 'JSN2014',
      });
    }
  }

  targets.phosphorus = resolveNutrientRules(
    'phosphorus',
    rulesByNutrient.phosphorus,
    baseTargets.phosphorus ?? null,
    input.instructions?.phosphorus
  );

  // D13: 抗がん剤などの副作用（症状別のコツ・合併時注意の生成）
  const cookingFormTags: string[] = [];
  const symptomTips: { label: string; tip: string }[] = [];

  const isDialysis = hasCkd && (ckdStage === 'HD' || ckdStage === 'PD');

  if (hasChemo) {
    usedSourcesSet.add('GANJOHO');
    for (const symKey of chemoSymptoms) {
      const guide = D13_CHEMO_GUIDANCE.find((g) => g.id === symKey);
      if (!guide) continue;

      guide.cookingForms.forEach((f) => {
        if (!cookingFormTags.includes(f)) cookingFormTags.push(f);
      });

      for (const tip of guide.tips) {
        let adjustedTip = tip;
        if (guide.needsPotassiumSaltCaution && (hasCkd || hasHeartFailure)) {
          adjustedTip +=
            '（※腎臓病のカリウム制限や心不全の塩分制限があるため、果物・海藻・きのこ・野菜の多量摂取やスポーツドリンク・みそ汁は担当医に相談してからにしてください）';
        }
        symptomTips.push({ label: guide.name, tip: adjustedTip });
      }

      if (guide.hasConstipationFluidTip) {
        if (hasHeartFailure || isDialysis) {
          symptomTips.push({
            label: '便秘（水分注意）',
            tip: '水分は病院の指示に従ってください（心不全・透析があるため、一般的な1.5〜2Lの飲水目安は適用しません）。',
          });
        } else {
          symptomTips.push({
            label: '便秘（水分）',
            tip: '水分を十分にとります（一般的には1日1.5〜2L程度。個人差があります）。',
          });
        }
      }
    }

    if (input.avoidRawFood) {
      cookingFormTags.push('生もの・非加熱発酵食品・ドライフルーツ除外');
      symptomTips.push({
        label: '生もの回避',
        tip: '生肉・刺身・生野菜・加熱しない発酵食品・ドライフルーツを含む料理を提案から除外しています。加熱した発酵食品（みそ汁等）をとってよいかは医師・管理栄養士に確かめてください。',
      });
    }
  }

  for (const key of ALL_NUTRIENTS) {
    targets[key].sources.forEach((s) => usedSourcesSet.add(s));
  }

  return {
    ageBand,
    standardWeightKg: sw,
    bmi,
    bmrKcal,
    eerKcal,
    targets,
    notices: uniqueStrings(notices),
    cookingFormTags: uniqueStrings(cookingFormTags),
    symptomTips,
    usedSources: Array.from(usedSourcesSet),
  };
}

export function validateMealRatios(ratios: MealRatios): {
  valid: boolean;
  sum: number;
  error?: string;
} {
  const sum = ratios.breakfast + ratios.lunch + ratios.dinner;
  if (
    ratios.breakfast < 0 ||
    ratios.lunch < 0 ||
    ratios.dinner < 0 ||
    sum !== 100
  ) {
    return {
      valid: false,
      sum,
      error: `朝・昼・夕の配分合計は100%にしてください（現在の合計：${sum}%）。`,
    };
  }
  return { valid: true, sum };
}

export function formatDailyTarget(
  target: DailyTargetValue,
  unit: string
): string {
  switch (target.type) {
    case 'instruction': {
      const cmp =
        target.compare === 'lt'
          ? '未満'
          : target.compare === 'le'
            ? '以下'
            : target.compare === 'ge'
              ? '以上'
              : 'くらい';
      return `${target.value.toLocaleString()}${unit}${cmp}（病院の指示）`;
    }
    case 'range': {
      if (target.min != null && target.max != null) {
        if (target.min === target.max) {
          return `${target.min.toLocaleString()}${unit} くらい`;
        }
        return `${target.min.toLocaleString()}${unit}以上 ${target.max.toLocaleString()}${unit}${
          target.maxExclusive ? '未満' : '以下'
        }`;
      }
      if (target.max != null) {
        return `${target.max.toLocaleString()}${unit}${
          target.maxExclusive ? '未満' : '以下'
        }`;
      }
      if (target.min != null) {
        return `${target.min.toLocaleString()}${unit}以上`;
      }
      return '目安なし';
    }
    case 'text':
      return target.text;
    case 'needInstruction':
      return '病院の指示を入力してください';
    case 'missing':
      return target.message;
  }
}

/**
 * 1食の合計と1日目安×食事配分（朝30%/昼35%/夕35%）を比較する
 */
export function compareMealWithTarget(
  nutrient: NutrientKey,
  dailyTarget: DailyTargetValue,
  mealTotal: number | null,
  mealRatioPercent: number,
  unit: string,
  options?: { isUncertain?: boolean }
): MealComparisonItem {
  const ratio = mealRatioPercent / 100;

  if (mealTotal === null || Number.isNaN(mealTotal)) {
    return {
      nutrient,
      actual: null,
      status: 'uncertain',
      mealLimitText: '未測定項目あり',
      message: 'データなし（計算が不確か）',
    };
  }

  if (options?.isUncertain) {
    return {
      nutrient,
      actual: mealTotal,
      status: 'uncertain',
      mealLimitText: '要確認',
      message: '計算が不確か',
    };
  }

  const total = roundFloat(mealTotal, 6);

  if (
    dailyTarget.type === 'needInstruction' ||
    dailyTarget.type === 'missing' ||
    dailyTarget.type === 'text'
  ) {
    return {
      nutrient,
      actual: mealTotal,
      status: 'uncompared',
      mealLimitText: '比較対象外',
      message: '目安が決まっていないため比べていません',
    };
  }

  if (dailyTarget.type === 'instruction') {
    const scaled = roundFloat(dailyTarget.value * ratio, 6);
    const displayScaled = round1(scaled);

    if (dailyTarget.compare === 'ge') {
      return {
        nutrient,
        actual: mealTotal,
        status: 'ok',
        mealLimitText: `${displayScaled}${unit}以上目安（1日合計で判断）`,
        message: '下限の目安は1日の合計で判断します',
      };
    }

    if (dailyTarget.compare === 'about') {
      const upper = roundFloat(scaled * 1.1, 6);
      const isHigh = total > upper;
      return {
        nutrient,
        actual: mealTotal,
        status: isHigh ? 'high' : 'ok',
        mealLimitText: `${displayScaled}${unit}くらい（${round1(upper)}${unit}超で多め）`,
        message: isHigh ? '多め' : '目安内',
      };
    }

    if (dailyTarget.compare === 'lt') {
      const isHigh = total >= scaled;
      return {
        nutrient,
        actual: mealTotal,
        status: isHigh ? 'high' : 'ok',
        mealLimitText: `${displayScaled}${unit}未満`,
        message: isHigh ? '多め' : '目安内',
      };
    }

    // 'le'
    const isHigh = total > scaled;
    return {
      nutrient,
      actual: mealTotal,
      status: isHigh ? 'high' : 'ok',
      mealLimitText: `${displayScaled}${unit}以下`,
      message: isHigh ? '多め' : '目安内',
    };
  }

  // range
  // 下限だけのものは1食では警告しない
  if (dailyTarget.max == null) {
    const displayMin =
      dailyTarget.min != null ? round1(dailyTarget.min * ratio) : null;
    return {
      nutrient,
      actual: mealTotal,
      status: 'ok',
      mealLimitText:
        displayMin != null ? `1食参考 ${displayMin}${unit}以上（1日合計で判断）` : '1日合計で判断',
      message: '下限の目安は1日の合計で判断します',
    };
  }

  // 病気なしのカロリー（min === max）は 目安×配分×1.1 を超えたら多め
  if (dailyTarget.min != null && dailyTarget.min === dailyTarget.max) {
    const scaled = roundFloat(dailyTarget.max * ratio, 6);
    const upper = roundFloat(scaled * 1.1, 6);
    const isHigh = total > upper;
    return {
      nutrient,
      actual: mealTotal,
      status: isHigh ? 'high' : 'ok',
      mealLimitText: `${round1(scaled)}${unit}くらい（${round1(upper)}${unit}超で多め）`,
      message: isHigh ? '多め' : '目安内',
    };
  }

  // 上限（max）
  const scaledMax = roundFloat(dailyTarget.max * ratio, 6);
  const displayMax = round1(scaledMax);
  const isHigh = dailyTarget.maxExclusive ? total >= scaledMax : total > scaledMax;
  return {
    nutrient,
    actual: mealTotal,
    status: isHigh ? 'high' : 'ok',
    mealLimitText: `${displayMax}${unit}${dailyTarget.maxExclusive ? '未満' : '以下'}`,
    message: isHigh ? '多め' : '目安内',
  };
}
