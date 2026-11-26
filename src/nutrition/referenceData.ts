export type BiologicalSex = 'male' | 'female';

export type ActivityLevel = 'low' | 'normal' | 'high';

export type AgeBand =
  | '1-2'
  | '3-5'
  | '6-7'
  | '8-9'
  | '10-11'
  | '12-14'
  | '15-17'
  | '18-29'
  | '30-49'
  | '50-64'
  | '65-74'
  | '75+';

export type NutrientKey =
  | 'energy'
  | 'protein'
  | 'fat'
  | 'carb'
  | 'fiber'
  | 'salt'
  | 'potassium'
  | 'phosphorus'
  | 'water';

export type SourceId =
  | 'DRI2025'
  | 'JSN2014'
  | 'JSH'
  | 'JDS2024'
  | 'JCS2025'
  | 'JSGE2023'
  | 'GANJOHO'
  | 'JASSO2022'
  | 'FOOD_COMP_8TH';

export interface ReferenceSource {
  sourceId: SourceId;
  name: string;
  url: string;
  verificationStatus: 'confirmed' | 'patient_guide';
  note?: string;
}

export const REFERENCE_SOURCES: Record<SourceId, ReferenceSource> = {
  DRI2025: {
    sourceId: 'DRI2025',
    name: '厚生労働省「日本人の食事摂取基準（2025年版）」',
    url: 'https://www.mhlw.go.jp/stf/newpage_44138.html',
    verificationStatus: 'confirmed',
  },
  JSN2014: {
    sourceId: 'JSN2014',
    name: '日本腎臓学会「慢性腎臓病に対する食事療法基準 2014年版」',
    url: 'https://jsn.or.jp/academicinfo/report/CKD_diet_standard_2014.pdf',
    verificationStatus: 'confirmed',
    note: '2026年版改訂中。改訂版公開後に差し替え予定。',
  },
  JSH: {
    sourceId: 'JSH',
    name: '日本高血圧学会「高血圧管理・治療ガイドライン／減塩推進資料」',
    url: 'https://www.jpnsh.jp/general_salt.html',
    verificationStatus: 'confirmed',
  },
  JDS2024: {
    sourceId: 'JDS2024',
    name: '日本糖尿病学会「糖尿病診療ガイドライン2024」',
    url: 'https://www.jds.or.jp/modules/publication/index.php?content_id=4',
    verificationStatus: 'confirmed',
  },
  JCS2025: {
    sourceId: 'JCS2025',
    name: '日本循環器学会「2025年改訂版 心不全診療ガイドライン」',
    url: 'https://www.j-circ.or.jp/cms/wp-content/uploads/2025/03/JCS2025_Kato.pdf',
    verificationStatus: 'confirmed',
  },
  JSGE2023: {
    sourceId: 'JSGE2023',
    name: '日本消化器病学会「患者さんとご家族のための肝硬変ガイド 2023」',
    url: 'https://www.jsge.or.jp/committees/guideline/disease/pdf/kankouhen_2023.pdf',
    verificationStatus: 'patient_guide',
    note: '医師向け肝硬変診療ガイドライン2026は未確認のため、エネルギー・たんぱく質数値は病院指示入力とします。',
  },
  GANJOHO: {
    sourceId: 'GANJOHO',
    name: '国立がん研究センター がん情報サービス「症状別の食事の工夫」',
    url: 'https://ganjoho.jp/public/support/dietarylife/index.html',
    verificationStatus: 'confirmed',
  },
  JASSO2022: {
    sourceId: 'JASSO2022',
    name: '日本肥満学会「肥満症診療ガイドライン2022 第5章」',
    url: 'https://www.jasso.or.jp/contents/magazine/journal.html',
    verificationStatus: 'confirmed',
  },
  FOOD_COMP_8TH: {
    sourceId: 'FOOD_COMP_8TH',
    name: '文部科学省「日本食品標準成分表（八訂）増補2023年」を加工して作成',
    url: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html',
    verificationStatus: 'confirmed',
    note: '可食部100gあたり。Tr・(0)は0、-（未測定）はデータなしとして扱います。',
  },
};

export const NUTRIENT_META: Record<
  NutrientKey,
  { label: string; unit: string; shortLabel: string }
> = {
  energy: { label: 'エネルギー', shortLabel: 'カロリー', unit: 'kcal' },
  protein: { label: 'たんぱく質', shortLabel: 'たんぱく質', unit: 'g' },
  fat: { label: '脂質', shortLabel: '脂質', unit: 'g' },
  carb: { label: '炭水化物', shortLabel: '炭水化物', unit: 'g' },
  fiber: { label: '食物繊維', shortLabel: '食物繊維', unit: 'g' },
  salt: { label: '食塩相当量', shortLabel: '食塩', unit: 'g' },
  potassium: { label: 'カリウム', shortLabel: 'カリウム', unit: 'mg' },
  phosphorus: { label: 'リン', shortLabel: 'リン', unit: 'mg' },
  water: { label: '水分', shortLabel: '水分', unit: 'mL' },
};

// D1. 推定エネルギー必要量：体重1kgあたり（kcal/kg/日）DRI2025 エネルギー章 参考表1 ✅
// 並び = [low, normal, high]
export const D1_EER_PER_KG: Record<
  BiologicalSex,
  Record<AgeBand, [number | null, number, number | null]>
> = {
  male: {
    '1-2': [null, 82.4, null],
    '3-5': [null, 79.5, null],
    '6-7': [59.8, 68.7, 77.5],
    '8-9': [57.1, 65.3, 73.4],
    '10-11': [54.2, 61.7, 69.2],
    '12-14': [46.5, 52.7, 58.9],
    '15-17': [41.9, 47.3, 52.7],
    '18-29': [35.6, 41.5, 47.4],
    '30-49': [33.8, 39.4, 45.0],
    '50-64': [32.7, 38.2, 43.6],
    '65-74': [32.4, 36.7, 41.0],
    '75+': [30.1, 36.6, null],
  },
  female: {
    '1-2': [null, 80.6, null],
    '3-5': [null, 75.7, null],
    '6-7': [56.6, 64.9, 73.3],
    '8-9': [53.6, 61.3, 68.9],
    '10-11': [50.5, 57.4, 64.4],
    '12-14': [44.4, 50.3, 56.2],
    '15-17': [39.2, 44.3, 49.3],
    '18-29': [33.2, 38.7, 44.2],
    '30-49': [32.9, 38.3, 43.8],
    '50-64': [31.1, 36.2, 41.4],
    '65-74': [31.1, 35.2, 39.3],
    '75+': [29.0, 35.2, null],
  },
};

// D2. 基礎代謝基準値（kcal/kg体重/日）DRI2025 エネルギー章 表3 ✅
export const D2_BMR_PER_KG: Record<BiologicalSex, Record<AgeBand, number>> = {
  male: {
    '1-2': 61.0,
    '3-5': 54.8,
    '6-7': 44.3,
    '8-9': 40.8,
    '10-11': 37.4,
    '12-14': 31.0,
    '15-17': 27.0,
    '18-29': 23.7,
    '30-49': 22.5,
    '50-64': 21.8,
    '65-74': 21.6,
    '75+': 21.5,
  },
  female: {
    '1-2': 59.7,
    '3-5': 52.2,
    '6-7': 41.9,
    '8-9': 38.3,
    '10-11': 34.8,
    '12-14': 29.6,
    '15-17': 25.3,
    '18-29': 22.1,
    '30-49': 21.9,
    '50-64': 20.7,
    '65-74': 20.7,
    '75+': 20.7,
  },
};

// D3. 身体活動レベル（男女共通）DRI2025 エネルギー章 表4・表5 ✅
export const D3_PAL: Record<AgeBand, [number | null, number, number | null]> = {
  '1-2': [null, 1.35, null],
  '3-5': [null, 1.45, null],
  '6-7': [1.35, 1.55, 1.75],
  '8-9': [1.4, 1.6, 1.8],
  '10-11': [1.45, 1.65, 1.85],
  '12-14': [1.5, 1.7, 1.9],
  '15-17': [1.55, 1.75, 1.95],
  '18-29': [1.5, 1.75, 2.0],
  '30-49': [1.5, 1.75, 2.0],
  '50-64': [1.5, 1.75, 2.0],
  '65-74': [1.5, 1.7, 1.9],
  '75+': [1.4, 1.7, null],
};

export const ACTIVITY_DESCRIPTIONS: Record<
  ActivityLevel,
  { label: string; description: string; senior75Note?: string }
> = {
  low: {
    label: '低い（I）',
    description: '生活の大部分が座位で静的な活動が中心',
    senior75Note: '75歳以上の「低い」は、自宅にいてほとんど外出しない人を想定しています。',
  },
  normal: {
    label: 'ふつう（II）',
    description:
      '座位中心だが移動・立位の作業・接客、通勤・買い物の歩行、家事、軽いスポーツのいずれかを含む',
  },
  high: {
    label: '高い（III）',
    description: '移動や立位の多い仕事、または余暇に活発な運動習慣',
    senior75Note: '75歳以上には「高い」の基準がないため、「ふつう」で計算します。',
  },
};

// D4. 食塩相当量の目標量（g/日・未満）DRI2025 ナトリウム 表1 ✅
export const D4_SALT_DG: Record<BiologicalSex, Record<AgeBand, number>> = {
  male: {
    '1-2': 3.0,
    '3-5': 3.5,
    '6-7': 4.5,
    '8-9': 5.0,
    '10-11': 6.0,
    '12-14': 7.0,
    '15-17': 7.5,
    '18-29': 7.5,
    '30-49': 7.5,
    '50-64': 7.5,
    '65-74': 7.5,
    '75+': 7.5,
  },
  female: {
    '1-2': 2.5,
    '3-5': 3.5,
    '6-7': 4.5,
    '8-9': 5.0,
    '10-11': 6.0,
    '12-14': 6.5,
    '15-17': 6.5,
    '18-29': 6.5,
    '30-49': 6.5,
    '50-64': 6.5,
    '65-74': 6.5,
    '75+': 6.5,
  },
};

// D5. カリウムの目標量（mg/日・以上＝多めにとる）DRI2025 カリウム 表2 ✅（1-2歳は無し）
export const D5_POTASSIUM_DG: Record<
  BiologicalSex,
  Partial<Record<AgeBand, number>>
> = {
  male: {
    '3-5': 1600,
    '6-7': 1800,
    '8-9': 2000,
    '10-11': 2200,
    '12-14': 2600,
    '15-17': 3000,
    '18-29': 3000,
    '30-49': 3000,
    '50-64': 3000,
    '65-74': 3000,
    '75+': 3000,
  },
  female: {
    '3-5': 1400,
    '6-7': 1600,
    '8-9': 1800,
    '10-11': 2000,
    '12-14': 2400,
    '15-17': 2600,
    '18-29': 2600,
    '30-49': 2600,
    '50-64': 2600,
    '65-74': 2600,
    '75+': 2600,
  },
};

// D6. たんぱく質の推奨量（g/日・下限の目安）DRI2025 たんぱく質 ✅
export const D6_PROTEIN_RDA: Record<BiologicalSex, Record<AgeBand, number>> = {
  male: {
    '1-2': 20,
    '3-5': 25,
    '6-7': 30,
    '8-9': 40,
    '10-11': 45,
    '12-14': 60,
    '15-17': 65,
    '18-29': 65,
    '30-49': 65,
    '50-64': 65,
    '65-74': 60,
    '75+': 60,
  },
  female: {
    '1-2': 20,
    '3-5': 25,
    '6-7': 30,
    '8-9': 40,
    '10-11': 50,
    '12-14': 55,
    '15-17': 55,
    '18-29': 50,
    '30-49': 50,
    '50-64': 50,
    '65-74': 50,
    '75+': 50,
  },
};

// D7. 食物繊維の目標量（g/日・以上）DRI2025 炭水化物 ✅（1-2歳は無し）
export const D7_FIBER_DG: Record<
  BiologicalSex,
  Partial<Record<AgeBand, number>>
> = {
  male: {
    '3-5': 8,
    '6-7': 10,
    '8-9': 11,
    '10-11': 13,
    '12-14': 17,
    '15-17': 19,
    '18-29': 20,
    '30-49': 22,
    '50-64': 22,
    '65-74': 21,
    '75+': 20,
  },
  female: {
    '3-5': 8,
    '6-7': 9,
    '8-9': 11,
    '10-11': 13,
    '12-14': 16,
    '15-17': 18,
    '18-29': 18,
    '30-49': 18,
    '50-64': 18,
    '65-74': 18,
    '75+': 17,
  },
};

// D8. エネルギー産生栄養素バランス（%エネルギー・目標量、男女共通）DRI2025 ✅
export const D8_PFC_PERCENT = {
  protein: {
    age1to49: { min: 13, max: 20 },
    age50to64: { min: 14, max: 20 },
    age65plus: { min: 15, max: 20 },
  },
  fat: { min: 20, max: 30 },
  saturatedFatMax: {
    age3to14: 10,
    age15to17: 9,
    age18plus: 7,
  },
  carb: { min: 50, max: 65 },
} as const;

// D9. 腎臓病（CKD）JSN2014 表1・表2 ✅
export type CkdStage = 'G1_G2' | 'G3a' | 'G3b' | 'G4_G5' | 'HD' | 'PD' | 'unknown';

export const CKD_STAGE_OPTIONS: { id: CkdStage; label: string }[] = [
  { id: 'G1_G2', label: 'ステージ G1・G2' },
  { id: 'G3a', label: 'ステージ G3a' },
  { id: 'G3b', label: 'ステージ G3b' },
  { id: 'G4_G5', label: 'ステージ G4・G5' },
  { id: 'HD', label: '血液透析（HD・週3回）' },
  { id: 'PD', label: '腹膜透析（PD）' },
  { id: 'unknown', label: '分からない' },
];

export interface CkdStageSpec {
  energyPerSw?: [number, number];
  proteinPerSw?: [number, number];
  proteinText?: string;
  saltMin?: number;
  saltMax?: number;
  saltMaxExclusive?: boolean;
  saltNeedInstruction?: string;
  potassiumMax?: number;
  potassiumText?: string;
  phosphorusFormula?: 'protein_x_15' | 'none_text';
  waterNeedInstruction?: string;
  note?: string;
}

export const D9_CKD_SPECS: Record<Exclude<CkdStage, 'unknown'>, CkdStageSpec> = {
  G1_G2: {
    energyPerSw: [25, 35],
    proteinText: '過剰な摂取をしない',
    saltMin: 3,
    saltMax: 6,
    saltMaxExclusive: true,
    potassiumText: '制限なし',
    phosphorusFormula: 'none_text',
  },
  G3a: {
    energyPerSw: [25, 35],
    proteinPerSw: [0.8, 1.0],
    saltMin: 3,
    saltMax: 6,
    saltMaxExclusive: true,
    potassiumText: '制限なし',
    phosphorusFormula: 'none_text',
  },
  G3b: {
    energyPerSw: [25, 35],
    proteinPerSw: [0.6, 0.8],
    saltMin: 3,
    saltMax: 6,
    saltMaxExclusive: true,
    potassiumMax: 2000,
    phosphorusFormula: 'none_text',
  },
  G4_G5: {
    energyPerSw: [25, 35],
    proteinPerSw: [0.6, 0.8],
    saltMin: 3,
    saltMax: 6,
    saltMaxExclusive: true,
    potassiumMax: 1500,
    phosphorusFormula: 'none_text',
  },
  HD: {
    energyPerSw: [30, 35],
    proteinPerSw: [0.9, 1.2],
    saltMax: 6,
    saltMaxExclusive: true,
    potassiumMax: 2000,
    phosphorusFormula: 'protein_x_15',
    waterNeedInstruction: '血液透析の水分は「できるだけ少なく」が基本です。病院の指示を入力してください。',
  },
  PD: {
    energyPerSw: [30, 35],
    proteinPerSw: [0.9, 1.2],
    saltNeedInstruction:
      '腹膜透析の食塩は「PD除水量(L)×7.5＋尿量(L)×5」で計算するため、病院の指示を入力してください。',
    waterNeedInstruction:
      '腹膜透析の水分は「PD除水量＋尿量」で決まるため、病院の指示を入力してください。',
    potassiumText: '制限なし',
    phosphorusFormula: 'protein_x_15',
    note: '腹膜透析のエネルギーは腹膜吸収ブドウ糖分を差し引きます。高カリウム血症がある場合は血液透析と同様（2,000mg以下）です。',
  },
};

// D12. 肝硬変の腹水区分 JSGE2023 ⚠
export type CirrhosisAscitesStatus = 'yes' | 'no' | 'unknown';

export const CIRRHOSIS_ASCITES_OPTIONS: { id: CirrhosisAscitesStatus; label: string }[] = [
  { id: 'yes', label: '腹水あり' },
  { id: 'no', label: '腹水なし' },
  { id: 'unknown', label: '分からない' },
];

// D13. 抗がん剤などの副作用 GANJOHO ✅（数値は置かない。レシピ絞り込みとコツ表示に使用）
export type ChemoSymptomKey =
  | 'stomatitis'
  | 'taste_smell'
  | 'nausea'
  | 'anorexia'
  | 'diarrhea'
  | 'constipation'
  | 'dysphagia';

export interface ChemoSymptomGuidance {
  id: ChemoSymptomKey;
  name: string;
  cookingForms: string[];
  tips: string[];
  /** 腎臓病（カリウム制限）や心不全（食塩・水分）と合併時に注意書きを添えるフラグ */
  needsPotassiumSaltCaution?: boolean;
  hasConstipationFluidTip?: boolean;
}

export const D13_CHEMO_GUIDANCE: ChemoSymptomGuidance[] = [
  {
    id: 'stomatitis',
    name: '口内炎',
    cookingForms: ['人肌程度に冷ます', '薄味（酸味・香辛料控えめ）', '軟らかく・とろみ'],
    tips: [
      '人肌程度に冷まし、酸味・香辛料を控えた薄味にします（梅干し・レモンなど酸味の強いものはしみることがあります）。',
      '軟らかくする・細かく刻む・とろみをつけるなど、水分が多く口当たりのよい調理にします。',
    ],
  },
  {
    id: 'taste_smell',
    name: '味覚・においの変化',
    cookingForms: ['人肌程度', 'だし重視・塩味控えめ', 'においが気になるときは冷ます'],
    tips: [
      '食べたいときに少量ずつ。人肌程度の温度が味を感じやすいです。',
      '塩味に苦味・金属味を感じるときはだしを効かせて塩味を控えめにし、マヨネーズで苦味を抑える工夫もあります。',
      'においが気になるときは冷ます、すし飯やサンドイッチなど冷たいもの、レトルト・冷凍食品・総菜・缶詰の利用もよいです。',
    ],
  },
  {
    id: 'nausea',
    name: '吐き気',
    cookingForms: ['室温〜冷ましめ', 'におい・脂肪控えめ', '少量ずつ小皿に'],
    tips: [
      '無理に食べず、少量を数回に分けて小さい皿に盛ります。',
      '消化のよいもの（お粥・軟らかい麺・軟らかく煮た野菜）、室温程度に冷ましたもの、冷たく口当たりのよいもの（卵豆腐・冷ややっこ・冷たい麺・果物等）が食べやすいです。',
      'においが強いもの（炊きたてご飯・焼き魚・具の多い煮物）や脂肪の多い揚げ物は控えます。',
    ],
  },
  {
    id: 'anorexia',
    name: '食欲不振',
    cookingForms: ['冷たい・のど越し重視', 'やわらかめ', '少量高栄養・分割食'],
    tips: [
      '食べたいとき・食べられそうなときに、少量を数回に分けてとります。',
      '冷たいもの・のど越しのよいもの・やわらかいもの（麺類・茶わん蒸し・ゼリー・果物等）や、少量でも栄養価の高いものを取り入れます。',
      '薬物療法の影響なら酢の物・すし飯・果物など酸味のあるものが食べやすいこともあります（糖尿病など他の病気がある人は担当者に相談してください）。',
    ],
  },
  {
    id: 'diarrhea',
    name: '下痢',
    cookingForms: ['常温に近い温度', '消化のよい加熱食', '低脂肪・刺激物控えめ'],
    tips: [
      'おかゆなど消化のよいものを選び、冷たいものより常温に近いものにします。',
      '水分と電解質（水・経口補水液・スポーツドリンク・スープ・みそ汁）を補い、カフェイン・高脂肪・乳製品・食物繊維の多いもの・アルコール・刺激物は控えます。',
    ],
    needsPotassiumSaltCaution: true,
  },
  {
    id: 'constipation',
    name: '便秘',
    cookingForms: ['食物繊維・乳酸菌の活用', '十分な水分'],
    tips: [
      '食物繊維（豆類・きのこ・海藻・果物）やヨーグルトなど乳酸菌を含む食品を取り入れます（体の状態によってはとりすぎがよくないので担当医に相談してください）。',
    ],
    needsPotassiumSaltCaution: true,
    hasConstipationFluidTip: true,
  },
  {
    id: 'dysphagia',
    name: '嚥下（飲み込み）配慮',
    cookingForms: ['やわらかめ', '細かく刻む', 'とろみをつける'],
    tips: [
      '調理の基本は「軟らかくする・細かく刻む・とろみをつける」です。',
      '嚥下調整食の段階分けはアプリで自動判定しません。「やわらか」印のレシピを参考にしつつ、食形態の段階は必ず医師・言語聴覚士・管理栄養士の指示に従ってください。',
    ],
  },
];
