/** 建物の建設・強化のルール（純粋関数） */
import { BUILDINGS } from './config';
import type { CellKey } from './grid';
import { isUnlocked, townStage } from './land';
import type { BuildingType, PlacedBuilding, SaveData } from './types';

export function getBuilding(save: SaveData, cell: CellKey): PlacedBuilding | null {
  return save.buildings[cell] ?? null;
}

export function buildCost(type: BuildingType): number {
  return BUILDINGS[type].buildCost;
}

/** 次のレベルに上げる費用。最大レベルなら null */
export function upgradeCost(type: BuildingType, currentLevel: number): number | null {
  const spec = BUILDINGS[type];
  if (currentLevel >= spec.maxLevel) return null;
  return spec.upgradeCosts[currentLevel - 1] ?? null;
}

export function canBuild(save: SaveData, cell: CellKey, type: BuildingType): boolean {
  if (!save.land.includes(cell)) return false;
  if (!isUnlocked(save, type)) return false;
  if (getBuilding(save, cell)) return false;
  return save.stars >= buildCost(type);
}

export function canUpgrade(save: SaveData, cell: CellKey): boolean {
  const b = getBuilding(save, cell);
  if (!b) return false;
  const cost = upgradeCost(b.type, b.level);
  if (cost === null) return false;
  return save.stars >= cost;
}

/** 建設する。成功なら建てた建物、失敗なら null */
export function build(save: SaveData, cell: CellKey, type: BuildingType, now: number): PlacedBuilding | null {
  if (!canBuild(save, cell, type)) return null;
  const cost = buildCost(type);
  save.stars -= cost;
  save.totalSpentStars += cost;
  const placed: PlacedBuilding = { type, level: 1, builtAt: now, upgradedAt: now };
  save.buildings[cell] = placed;
  return placed;
}

/** レベルを1上げる。成功なら更新後の建物、失敗なら null */
export function upgrade(save: SaveData, cell: CellKey, now: number): PlacedBuilding | null {
  const b = getBuilding(save, cell);
  if (!b) return null;
  const cost = upgradeCost(b.type, b.level);
  if (cost === null || save.stars < cost) return null;
  save.stars -= cost;
  save.totalSpentStars += cost;
  b.level += 1;
  b.upgradedAt = now;
  return b;
}

/** 街の規模（建物のレベル合計）。演出や装飾の条件に使う */
export function townLevel(save: SaveData): number {
  return Object.values(save.buildings).reduce<number>((sum, b) => sum + (b?.level ?? 0), 0);
}

export function buildingCount(save: SaveData): number {
  return Object.values(save.buildings).filter(Boolean).length;
}

/** 街の呼び名（区画の数で決まる） */
export function townTitle(save: SaveData): string {
  return townStage(save.land.length).name;
}
