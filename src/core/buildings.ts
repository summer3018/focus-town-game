/** 建物の建設・強化のルール（純粋関数） */
import { BUILDINGS, SLOT_IDS } from './config';
import type { BuildingType, PlacedBuilding, SaveData, SlotId } from './types';

export function isSlotId(value: number): value is SlotId {
  return SLOT_IDS.includes(value as SlotId);
}

export function getBuilding(save: SaveData, slot: SlotId): PlacedBuilding | null {
  return save.buildings[slot] ?? null;
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

export function canBuild(save: SaveData, slot: SlotId, type: BuildingType): boolean {
  if (getBuilding(save, slot)) return false;
  return save.stars >= buildCost(type);
}

export function canUpgrade(save: SaveData, slot: SlotId): boolean {
  const b = getBuilding(save, slot);
  if (!b) return false;
  const cost = upgradeCost(b.type, b.level);
  if (cost === null) return false;
  return save.stars >= cost;
}

/** 建設する。成功なら建てた建物、失敗なら null */
export function build(save: SaveData, slot: SlotId, type: BuildingType, now: number): PlacedBuilding | null {
  if (!canBuild(save, slot, type)) return null;
  const cost = buildCost(type);
  save.stars -= cost;
  save.totalSpentStars += cost;
  const placed: PlacedBuilding = { type, level: 1, builtAt: now, upgradedAt: now };
  save.buildings[slot] = placed;
  return placed;
}

/** レベルを1上げる。成功なら更新後の建物、失敗なら null */
export function upgrade(save: SaveData, slot: SlotId, now: number): PlacedBuilding | null {
  const b = getBuilding(save, slot);
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
  return SLOT_IDS.reduce<number>((sum, slot) => sum + (save.buildings[slot]?.level ?? 0), 0);
}

export function buildingCount(save: SaveData): number {
  return SLOT_IDS.filter((slot) => Boolean(save.buildings[slot])).length;
}

/** 街のにぎやかさを一言で表す */
export function townTitle(save: SaveData): string {
  const level = townLevel(save);
  if (level === 0) return 'まだ何もない土地';
  if (level <= 2) return '小さな集落';
  if (level <= 5) return '芽が出はじめた街';
  if (level <= 9) return 'にぎやかになってきた街';
  if (level <= 14) return '人が集まる街';
  return 'みんなの街';
}
