/** 土地の購入と街の節目のルール（純粋関数） */
import { LAND_COST, TOWN_STAGES } from './config';
import type { TownStageSpec } from './config';
import { cellKey, neighbors4, parseCell } from './grid';
import type { CellKey } from './grid';
import type { BuildingType, SaveData } from './types';

export function landPrice(purchases: number): number {
  return Math.min(LAND_COST.max, LAND_COST.base + LAND_COST.step * Math.max(0, purchases));
}

/** 持っている土地に上下左右で接していて、まだ持っていない区画 */
export function buyableCells(save: SaveData): CellKey[] {
  const owned = new Set(save.land);
  const out = new Set<CellKey>();
  for (const cell of save.land) {
    for (const n of neighbors4(cell)) {
      if (!owned.has(n)) out.add(n);
    }
  }
  return [...out].sort();
}

/** 正しい書き方（"x,y"・余分な0なし）の座標キーか */
function isCanonical(cell: string): boolean {
  const p = parseCell(cell);
  return p !== null && cellKey(p.x, p.y) === cell;
}

export function canBuyLand(save: SaveData, cell: CellKey): boolean {
  if (!isCanonical(cell)) return false;
  if (save.land.includes(cell)) return false;
  if (!neighbors4(cell).some((n) => save.land.includes(n))) return false;
  return save.stars >= landPrice(save.landPurchases);
}

/** 土地を買う。成功なら払った値段、失敗なら null（何も変えない） */
export function buyLand(save: SaveData, cell: CellKey): { price: number } | null {
  if (!canBuyLand(save, cell)) return null;
  const price = landPrice(save.landPurchases);
  save.stars -= price;
  save.totalSpentStars += price;
  save.landPurchases += 1;
  save.land.push(cell);
  return { price };
}

export interface TownStage {
  index: number;
  name: string;
  /** ここまでに解放された建物（解放順） */
  unlocked: BuildingType[];
  next: TownStageSpec | null;
}

export function townStage(landCount: number): TownStage {
  let index = 0;
  for (let i = 0; i < TOWN_STAGES.length; i += 1) {
    if (landCount >= TOWN_STAGES[i]!.at) index = i;
  }
  const unlocked = TOWN_STAGES.slice(0, index + 1).flatMap((s) => s.unlocks);
  return { index, name: TOWN_STAGES[index]!.name, unlocked, next: TOWN_STAGES[index + 1] ?? null };
}

export function isUnlocked(save: SaveData, type: BuildingType): boolean {
  return townStage(save.land.length).unlocked.includes(type);
}

/** before → after で新しく越えた節目のうち、最後のもの。越えていなければ null */
export function stageReachedBy(beforeCount: number, afterCount: number): TownStageSpec | null {
  let reached: TownStageSpec | null = null;
  for (const s of TOWN_STAGES) {
    if (s.at > beforeCount && s.at <= afterCount) reached = s;
  }
  return reached;
}
