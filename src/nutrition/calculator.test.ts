import { describe, expect, it } from 'vitest';
import {
  calculateDailyTargets,
  compareMealWithTarget,
  validateMealRatios,
  type PersonNutritionInput,
} from './calculator';

const BASE_ADULT_MALE: PersonNutritionInput = {
  age: 40,
  sex: 'male',
  heightCm: 170,
  weightKg: 65,
  activity: 'normal',
  conditions: [],
};

describe('おうち献立ケア 栄養目安・自動計算 受け入れテスト（全28件）', () => {
  it('1. 40歳男性・170cm・65kg・normal・病気なし → energy 2,560kcalくらい、salt 7.5g未満、potassium 3,000mg以上', () => {
    const res = calculateDailyTargets(BASE_ADULT_MALE);
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 2560, max: 2560 });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 7.5, maxExclusive: true });
    expect(res.targets.potassium).toMatchObject({ type: 'range', min: 3000 });
  });

  it('2. 80歳女性・150cm・45kg・high → normalで計算 energy 1,580kcalくらい、salt 6.5g未満、お知らせあり', () => {
    const res = calculateDailyTargets({
      age: 80,
      sex: 'female',
      heightCm: 150,
      weightKg: 45,
      activity: 'high',
      conditions: [],
    });
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 1580, max: 1580 });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 6.5, maxExclusive: true });
    expect(res.notices.some((n) => n.includes('75+') && n.includes('ふつう'))).toBe(true);
  });

  it('3. 8歳男児・128cm・26kg・病気なし → salt 5.0g未満、potassium 2,000mg以上、energy 1,700kcalくらい', () => {
    const res = calculateDailyTargets({
      age: 8,
      sex: 'male',
      heightCm: 128,
      weightKg: 26,
      activity: 'normal',
      conditions: [],
    });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 5.0, maxExclusive: true });
    expect(res.targets.potassium).toMatchObject({ type: 'range', min: 2000 });
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 1700, max: 1700 });
  });

  it('4. 8歳・高血圧 → salt は needInstruction、「お子さん」のお知らせ', () => {
    const res = calculateDailyTargets({
      age: 8,
      sex: 'male',
      heightCm: 128,
      weightKg: 26,
      activity: 'normal',
      conditions: ['hypertension'],
    });
    expect(res.targets.salt.type).toBe('needInstruction');
    if (res.targets.salt.type === 'needInstruction') {
      expect(res.targets.salt.messages.some((m) => m.includes('お子さん'))).toBe(true);
    }
    expect(res.notices.some((n) => n.includes('お子さん'))).toBe(true);
  });

  it('5. 高血圧 → salt 6g未満', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['hypertension'],
    });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 6, maxExclusive: true });
  });

  it('6. 糖尿病 → energy needInstruction、salt 6g未満。指示1,600kcal(about)で1,600kcalくらい', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['diabetes'],
    });
    expect(res.targets.energy.type).toBe('needInstruction');
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 6, maxExclusive: true });

    const withInst = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['diabetes'],
      instructions: {
        energy: { value: 1600, compare: 'about' },
      },
    });
    expect(withInst.targets.energy).toMatchObject({
      type: 'instruction',
      value: 1600,
      compare: 'about',
    });
  });

  it('7. 心不全のみ（60歳・60kg）→ salt needInstruction、water「制限なし（医師の指示があれば入力）」、protein 66g以上', () => {
    const res = calculateDailyTargets({
      age: 60,
      sex: 'male',
      heightCm: 168,
      weightKg: 60,
      activity: 'normal',
      conditions: ['heart_failure'],
    });
    expect(res.targets.salt.type).toBe('needInstruction');
    expect(res.targets.water).toMatchObject({
      type: 'text',
      text: '制限なし（医師の指示があれば入力）',
    });
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 66 });
  });

  it('8. 心不全＋高血圧 → salt 6g未満（注記に心不全の指示のお願い）', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['heart_failure', 'hypertension'],
    });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 6, maxExclusive: true });
    if (res.targets.salt.type === 'range') {
      expect(res.targets.salt.notes.some((n) => n.includes('心不全'))).toBe(true);
    }
  });

  it('9. 心不全・70歳・50kg → protein 60〜75g', () => {
    const res = calculateDailyTargets({
      age: 70,
      sex: 'female',
      heightCm: 155,
      weightKg: 50,
      activity: 'normal',
      conditions: ['heart_failure'],
    });
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 60, max: 75 });
  });

  it('10. CKD G3b・160cm（SW 56.3）→ energy 1,410〜1,970kcal、protein 34〜45g、salt 3g以上6g未満、K 2,000mg以下、P数値目安なし', () => {
    const res = calculateDailyTargets({
      age: 60,
      sex: 'female',
      heightCm: 160,
      weightKg: 56,
      activity: 'normal',
      conditions: ['kidney_disease'],
      ckdStage: 'G3b',
    });
    expect(res.standardWeightKg).toBe(56.3);
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 1410, max: 1970 });
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 34, max: 45 });
    expect(res.targets.salt).toMatchObject({
      type: 'range',
      min: 3,
      max: 6,
      maxExclusive: true,
    });
    expect(res.targets.potassium).toMatchObject({ type: 'range', max: 2000 });
    expect(res.targets.phosphorus.type).toBe('text');
    if (res.targets.phosphorus.type === 'text') {
      expect(res.targets.phosphorus.text).toContain('数値の目安なし');
    }
  });

  it('11. CKD G3a・160cm → potassium「制限なし」（多め目標なし）、protein 45〜56g', () => {
    const res = calculateDailyTargets({
      age: 60,
      sex: 'female',
      heightCm: 160,
      weightKg: 56,
      activity: 'normal',
      conditions: ['kidney_disease'],
      ckdStage: 'G3a',
    });
    expect(res.targets.potassium).toMatchObject({ type: 'text', text: '制限なし' });
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 45, max: 56 });
  });

  it('12. 高血圧＋CKD G3b → salt 3g以上6g未満、potassium 2,000mg以下', () => {
    const res = calculateDailyTargets({
      age: 60,
      sex: 'female',
      heightCm: 160,
      weightKg: 56,
      activity: 'normal',
      conditions: ['hypertension', 'kidney_disease'],
      ckdStage: 'G3b',
    });
    expect(res.targets.salt).toMatchObject({
      type: 'range',
      min: 3,
      max: 6,
      maxExclusive: true,
    });
    expect(res.targets.potassium).toMatchObject({ type: 'range', max: 2000 });
  });

  it('13. CKD ステージ不明 → energy・protein・salt・potassium・phosphorus・water すべて needInstruction', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease'],
      ckdStage: 'unknown',
    });
    expect(res.targets.energy.type).toBe('needInstruction');
    expect(res.targets.protein.type).toBe('needInstruction');
    expect(res.targets.salt.type).toBe('needInstruction');
    expect(res.targets.potassium.type).toBe('needInstruction');
    expect(res.targets.phosphorus.type).toBe('needInstruction');
    expect(res.targets.water.type).toBe('needInstruction');
  });

  it('14. CKD HD・170cm（SW 63.6）→ protein 57〜76g、P 1,140mg以下、salt 6g未満、K 2,000mg以下、water needInstruction。protein指示60gでP 900mg以下', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease'],
      ckdStage: 'HD',
    });
    expect(res.standardWeightKg).toBe(63.6);
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 57, max: 76 });
    expect(res.targets.phosphorus).toMatchObject({ type: 'range', max: 1140 });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 6, maxExclusive: true });
    expect(res.targets.potassium).toMatchObject({ type: 'range', max: 2000 });
    expect(res.targets.water.type).toBe('needInstruction');

    const withProteinInst = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease'],
      ckdStage: 'HD',
      instructions: {
        protein: { value: 60, compare: 'about' },
      },
    });
    expect(withProteinInst.targets.phosphorus).toMatchObject({ type: 'range', max: 900 });
  });

  it('15. CKD PD → salt・water needInstruction、potassium「制限なし」', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease'],
      ckdStage: 'PD',
    });
    expect(res.targets.salt.type).toBe('needInstruction');
    expect(res.targets.water.type).toBe('needInstruction');
    expect(res.targets.potassium).toMatchObject({ type: 'text', text: '制限なし' });
  });

  it('16. CKD G3b＋心不全 → protein needInstruction（向きが逆）', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease', 'heart_failure'],
      ckdStage: 'G3b',
    });
    expect(res.targets.protein.type).toBe('needInstruction');
    if (res.targets.protein.type === 'needInstruction') {
      expect(res.targets.protein.messages.some((m) => m.includes('向きが逆'))).toBe(true);
    }
  });

  it('17. CKD G3b＋肝硬変 → protein needInstruction', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['kidney_disease', 'liver_cirrhosis'],
      ckdStage: 'G3b',
      cirrhosisAscites: 'no',
    });
    expect(res.targets.protein.type).toBe('needInstruction');
  });

  it('18. 肝硬変（腹水あり）→ salt 5〜7g、energy needInstruction、protein「極端に減らさない」', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['liver_cirrhosis'],
      cirrhosisAscites: 'yes',
    });
    expect(res.targets.salt).toMatchObject({ type: 'range', min: 5, max: 7 });
    expect(res.targets.energy.type).toBe('needInstruction');
    expect(res.targets.protein).toMatchObject({ type: 'text', text: '極端に減らさない' });
  });

  it('19. 肝硬変（腹水あり）＋高血圧 → salt 5g以上6g未満', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['liver_cirrhosis', 'hypertension'],
      cirrhosisAscites: 'yes',
    });
    expect(res.targets.salt).toMatchObject({
      type: 'range',
      min: 5,
      max: 6,
      maxExclusive: true,
    });
  });

  it('20. 肝硬変（腹水なし）→ salt 7.5g未満（男性）に「控えめに」の注記', () => {
    const res = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['liver_cirrhosis'],
      cirrhosisAscites: 'no',
    });
    expect(res.targets.salt).toMatchObject({ type: 'range', max: 7.5, maxExclusive: true });
    if (res.targets.salt.type === 'range') {
      expect(res.targets.salt.notes.some((n) => n.includes('控えめに'))).toBe(true);
    }
  });

  it('21. ダイエット・45歳男性・170cm・81kg（BMI 28.0）→ energy 1,590kcal以下（25×63.6）', () => {
    const res = calculateDailyTargets({
      age: 45,
      sex: 'male',
      heightCm: 170,
      weightKg: 81,
      activity: 'normal',
      conditions: ['diet'],
    });
    expect(res.bmi).toBe(28.0);
    expect(res.targets.energy).toMatchObject({ type: 'range', max: 1590 });
    if (res.targets.energy.type === 'range') {
      expect(res.targets.energy.min).toBeUndefined();
    }
  });

  it('22. ダイエット・BMI 36（170cm・104kg）→ energy 1,270〜1,590kcal', () => {
    const res = calculateDailyTargets({
      age: 45,
      sex: 'male',
      heightCm: 170,
      weightKg: 104,
      activity: 'normal',
      conditions: ['diet'],
    });
    expect(res.bmi).toBe(36.0);
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 1270, max: 1590 });
  });

  it('23. ダイエット・BMI 22（170cm・64kg）→ 減量計算をしない：energy 2,520kcalくらい＋お知らせ', () => {
    const res = calculateDailyTargets({
      age: 45,
      sex: 'male',
      heightCm: 170,
      weightKg: 64,
      activity: 'normal',
      conditions: ['diet'],
    });
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 2520, max: 2520 });
    expect(
      res.notices.some((n) => n.includes('体重を減らす必要は少ないかもしれません'))
    ).toBe(true);
  });

  it('24. ダイエット・70歳 → 減量計算をしない＋お知らせ', () => {
    const res = calculateDailyTargets({
      age: 70,
      sex: 'male',
      heightCm: 170,
      weightKg: 81,
      activity: 'normal',
      conditions: ['diet'],
    });
    // 70歳男性 normal 36.7 × 81 = 2972.7 → 2970kcal（EER）
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 2970, max: 2970 });
    expect(res.notices.some((n) => n.includes('筋肉が落ちる心配'))).toBe(true);
  });

  it('25. ダイエット＋CKD G3a（170cm）→ 減量計算をせず CKD の 1,590〜2,230kcal', () => {
    const res = calculateDailyTargets({
      age: 45,
      sex: 'male',
      heightCm: 170,
      weightKg: 81,
      activity: 'normal',
      conditions: ['diet', 'kidney_disease'],
      ckdStage: 'G3a',
    });
    expect(res.targets.energy).toMatchObject({ type: 'range', min: 1590, max: 2230 });
    expect(res.notices.some((n) => n.includes('筋肉が落ちる心配'))).toBe(true);
  });

  it('26. 糖尿病＋CKD G3b＋高血圧（160cm）→ energy needInstruction、protein 34〜45g、salt 3g以上6g未満、K 2,000mg以下、P数値目安なし', () => {
    const res = calculateDailyTargets({
      age: 60,
      sex: 'female',
      heightCm: 160,
      weightKg: 58,
      activity: 'normal',
      conditions: ['diabetes', 'kidney_disease', 'hypertension'],
      ckdStage: 'G3b',
    });
    expect(res.targets.energy.type).toBe('needInstruction');
    expect(res.targets.protein).toMatchObject({ type: 'range', min: 34, max: 45 });
    expect(res.targets.salt).toMatchObject({
      type: 'range',
      min: 3,
      max: 6,
      maxExclusive: true,
    });
    expect(res.targets.potassium).toMatchObject({ type: 'range', max: 2000 });
    expect(res.targets.phosphorus.type).toBe('text');
    if (res.targets.phosphorus.type === 'text') {
      expect(res.targets.phosphorus.text).toContain('数値の目安なし');
    }
  });

  it('27. 1食の比較：高血圧の夕食(35%)に食塩1.1g×2品=2.2gは「多め」、病気なし30歳男性は「多め」にならない', () => {
    const ht = calculateDailyTargets({
      ...BASE_ADULT_MALE,
      conditions: ['hypertension'],
    });
    const healthy = calculateDailyTargets({
      age: 30,
      sex: 'male',
      heightCm: 170,
      weightKg: 65,
      activity: 'normal',
      conditions: [],
    });

    const mealSaltTotal = 1.1 * 2; // 2.2g
    const cmpHt = compareMealWithTarget('salt', ht.targets.salt, mealSaltTotal, 35, 'g');
    const cmpHealthy = compareMealWithTarget(
      'salt',
      healthy.targets.salt,
      mealSaltTotal,
      35,
      'g'
    );

    expect(cmpHt.status).toBe('high');
    expect(cmpHt.message).toBe('多め');
    expect(cmpHealthy.status).toBe('ok');
    expect(cmpHealthy.message).not.toBe('多め');
  });

  it('28. 配分：朝30・昼30・夕30（合計90%）は保存しない', () => {
    const invalid = validateMealRatios({ breakfast: 30, lunch: 30, dinner: 30 });
    expect(invalid.valid).toBe(false);
    expect(invalid.sum).toBe(90);

    const valid = validateMealRatios({ breakfast: 30, lunch: 35, dinner: 35 });
    expect(valid.valid).toBe(true);
    expect(valid.sum).toBe(100);
  });
});
