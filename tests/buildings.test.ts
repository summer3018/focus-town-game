import { beforeEach, describe, expect, it } from 'vitest';
import {
  build,
  buildCost,
  buildingCount,
  canBuild,
  canUpgrade,
  townLevel,
  townTitle,
  upgrade,
  upgradeCost,
} from '../src/core/buildings';
import { INITIAL_CELLS } from '../src/core/config';
import { createNewSave } from '../src/core/storage';
import type { BuildingType, SaveData } from '../src/core/types';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();

describe('費用の設定', () => {
  it('建設費用は仕様どおり', () => {
    expect(buildCost('house')).toBe(20);
    expect(buildCost('shop')).toBe(30);
    expect(buildCost('park')).toBe(20);
  });

  it('強化費用はレベルごとに上がり、最大レベルでは null', () => {
    expect(upgradeCost('house', 1)).toBe(30);
    expect(upgradeCost('house', 2)).toBe(60);
    expect(upgradeCost('house', 3)).toBeNull();
    expect(upgradeCost('shop', 1)).toBe(45);
    expect(upgradeCost('park', 2)).toBe(60);
  });
});

describe('建設', () => {
  let save: SaveData;

  beforeEach(() => {
    save = createNewSave(T0);
  });

  it('スターが足りなければ建てられない', () => {
    save.stars = 19;
    expect(canBuild(save, '0,0', 'house')).toBe(false);
    expect(build(save, '0,0', 'house', T0)).toBeNull();
    expect(save.stars).toBe(19);
  });

  it('建てるとスターが減り、消費額が記録される', () => {
    save.stars = 50;
    const placed = build(save, '0,0', 'house', T0);
    expect(placed?.level).toBe(1);
    expect(save.stars).toBe(30);
    expect(save.totalSpentStars).toBe(20);
    expect(save.buildings['0,0']?.type).toBe('house');
  });

  it('同じ区画には二重に建てられない', () => {
    save.stars = 100;
    build(save, '0,0', 'house', T0);
    expect(build(save, '0,0', 'shop', T0)).toBeNull();
    expect(save.buildings['0,0']?.type).toBe('house');
    expect(save.stars).toBe(80);
  });

  it('6区画すべてに建てられる', () => {
    save.stars = 1000;
    for (const cell of INITIAL_CELLS) {
      expect(build(save, cell, 'park', T0)).not.toBeNull();
    }
    expect(buildingCount(save)).toBe(6);
  });
});

describe('強化', () => {
  let save: SaveData;

  beforeEach(() => {
    save = createNewSave(T0);
    save.stars = 500;
    build(save, '0,0', 'house', T0);
  });

  it('レベルが1ずつ上がり、費用が引かれる', () => {
    const before = save.stars;
    const b = upgrade(save, '0,0', T0 + 1);
    expect(b?.level).toBe(2);
    expect(save.stars).toBe(before - 30);
    const c = upgrade(save, '0,0', T0 + 2);
    expect(c?.level).toBe(3);
    expect(save.stars).toBe(before - 30 - 60);
  });

  it('最大レベルを超えない', () => {
    upgrade(save, '0,0', T0);
    upgrade(save, '0,0', T0);
    const before = save.stars;
    expect(upgrade(save, '0,0', T0)).toBeNull();
    expect(save.buildings['0,0']?.level).toBe(3);
    expect(save.stars).toBe(before);
  });

  it('スターが足りなければ上がらない', () => {
    save.stars = 10;
    expect(canUpgrade(save, '0,0')).toBe(false);
    expect(upgrade(save, '0,0', T0)).toBeNull();
    expect(save.buildings['0,0']?.level).toBe(1);
    expect(save.stars).toBe(10);
  });

  it('空き区画は強化できない', () => {
    expect(upgrade(save, '2,1', T0)).toBeNull();
  });
});

describe('街の規模', () => {
  it('レベルの合計と呼び名', () => {
    const save = createNewSave(T0);
    expect(townLevel(save)).toBe(0);

    save.stars = 1000;
    build(save, '0,0', 'house', T0);
    build(save, '1,0', 'shop', T0);
    expect(townLevel(save)).toBe(2);

    upgrade(save, '0,0', T0);
    upgrade(save, '0,0', T0);
    upgrade(save, '1,0', T0);
    expect(townLevel(save)).toBe(5);
  });
});

describe('節目による解放', () => {
  it('解放前の建物は、星があっても建てられない', () => {
    const save = createNewSave(T0);
    save.stars = 1000;
    expect(canBuild(save, '0,0', 'field')).toBe(false);
    expect(build(save, '0,0', 'field', T0)).toBeNull();
    expect(save.stars).toBe(1000);
  });

  it('townTitle は区画の数の呼び名', () => {
    const save = createNewSave(T0);
    expect(townTitle(save)).toBe('小さな村');
  });
});


describe('新しい建物の値段', () => {
  it('設計書の表どおり', () => {
    const table: [BuildingType, number, number, number][] = [
      ['field', 25, 35, 70],
      ['postOffice', 40, 60, 120],
      ['school', 60, 90, 180],
      ['station', 80, 120, 240],
      ['shoppingStreet', 100, 150, 300],
      ['office', 140, 210, 420],
      ['radioTower', 200, 300, 600],
    ];
    for (const [type, b, u1, u2] of table) {
      expect(buildCost(type)).toBe(b);
      expect(upgradeCost(type, 1)).toBe(u1);
      expect(upgradeCost(type, 2)).toBe(u2);
      expect(upgradeCost(type, 3)).toBeNull();
    }
  });
});
