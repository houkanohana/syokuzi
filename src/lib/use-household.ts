"use client";

// 献立の画面で使う「家のようす」をまとめて読む（スマホの中の保存場所から）
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { getExtraEaters } from "./people";
import { getMealRatio, getPantry, getPlan } from "./plan-store";

export function useHousehold() {
  const people = useLiveQuery(() => db.people.orderBy("id").toArray());
  const extra = useLiveQuery(getExtraEaters);
  const stock = useLiveQuery(() => db.stock.toArray());
  const pantry = useLiveQuery(getPantry);
  const ratio = useLiveQuery(getMealRatio);
  const plan = useLiveQuery(getPlan);
  const shopping = useLiveQuery(() => db.shopping.toArray());

  if (
    people === undefined ||
    extra === undefined ||
    stock === undefined ||
    pantry === undefined ||
    ratio === undefined ||
    plan === undefined ||
    shopping === undefined
  ) {
    return null;
  }
  return { people, extra, stock, pantry, ratio, plan, shopping };
}

export type Household = NonNullable<ReturnType<typeof useHousehold>>;
