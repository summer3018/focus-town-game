import { beforeEach, describe, expect, it } from 'vitest';
import { buyLand, buyableCells, canBuyLand, isUnlocked, landPrice, stageReachedBy, townStage } from '../src/core/land';
import { createNewSave } from '../src/core/storage';
import type { SaveData } from '../src/core/types';

const T0 = new Date('2026-11-18T09:00:00+09:00').getTime();

describe('土地の値段', () => {
  it('15★から1回ごとに5★上がり、60★で止まる', () => {
    expect(landPrice(0)).toBe(15);
    expect(landPrice(1)).toBe(20);
    expect(landPrice(9)).toBe(60);
    expect(landPrice(10)).toBe(60);
    expect(landPrice(100)).toBe(60);
  });
});

describe('買える土地', () => {
  it('最初は 3×2 の周りの10区画', () => {
    const cells = buyableCells(createNewSave(T0));
    expect(cells).toHaveLength(10);
    for (const c of ['3,0', '-1,1', '1,-1', '1,2']) expect(cells).toContain(c);
    expect(cells).not.toContain('0,0');
    expect(cells).not.toContain('-1,-1');
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('買った土地のとなりも買えるようになる', () => {
    const save = createNewSave(T0);
    save.stars = 100;
    expect(buyLand(save, '3,0')).not.toBeNull();
    expect(buyableCells(save)).toContain('4,0');
    expect(buyableCells(save)).not.toContain('3,0');
  });
});

describe('土地を買う', () => {
  let save: SaveData;
  beforeEach(() => {
    save = createNewSave(T0);
    save.stars = 30;
  });

  it('買うと星が減り、土地が1区画増える', () => {
    expect(buyLand(save, '3,0')).toEqual({ price: 15 });
    expect(save.stars).toBe(15);
    expect(save.totalSpentStars).toBe(15);
    expect(save.landPurchases).toBe(1);
    expect(save.land).toContain('3,0');
  });

  it('2回目は20★', () => {
    buyLand(save, '3,0');
    save.stars = 20;
    expect(buyLand(save, '4,0')).toEqual({ price: 20 });
  });

  const unchanged = (s: SaveData) => {
    expect(s.stars).toBe(14);
    expect(s.land).toHaveLength(6);
    expect(s.landPurchases).toBe(0);
    expect(s.totalSpentStars).toBe(0);
  };

  it('星が足りなければ買えず、何も変わらない', () => {
    save.stars = 14;
    expect(canBuyLand(save, '3,0')).toBe(false);
    expect(buyLand(save, '3,0')).toBeNull();
    unchanged(save);
  });

  it('となりにない土地・もう持っている土地・壊れた座標は買えない', () => {
    save.stars = 14;
    save.stars = 1000;
    for (const c of ['5,5', '0,0', 'a,b', '1.5,0']) {
      expect(canBuyLand(save, c)).toBe(false);
      expect(buyLand(save, c)).toBeNull();
    }
    expect(save.stars).toBe(1000);
    expect(save.land).toHaveLength(6);
    expect(save.landPurchases).toBe(0);
  });
});

describe('街の節目', () => {
  it('区画の数で呼び名と建てられる建物が決まる', () => {
    expect(townStage(6).name).toBe('小さな村');
    expect(townStage(6).unlocked).toEqual(['house', 'shop', 'park']);
    expect(townStage(11).next?.at).toBe(12);
    expect(townStage(12).name).toBe('村');
    expect(townStage(12).unlocked).toContain('field');
    expect(townStage(119).next?.name).toBe('大都市');
    expect(townStage(120).name).toBe('大都市');
    expect(townStage(120).next).toBeNull();
    expect(townStage(500).name).toBe('大都市');
    expect(townStage(500).unlocked).toHaveLength(10);
  });

  it('isUnlocked は持っている区画の数で判断する', () => {
    const save = createNewSave(T0);
    expect(isUnlocked(save, 'house')).toBe(true);
    expect(isUnlocked(save, 'field')).toBe(false);
  });

  it('stageReachedBy は越えた節目だけを返す', () => {
    expect(stageReachedBy(11, 12)?.name).toBe('村');
    expect(stageReachedBy(12, 13)).toBeNull();
    expect(stageReachedBy(10, 25)?.name).toBe('小さな町');
  });
});
