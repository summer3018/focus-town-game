import { describe, expect, it } from 'vitest';
import { INITIAL_CELLS, STARTING_STARS, STORAGE_KEYS } from '../src/core/config';
import { createMemoryStorage, createNewSave, loadSave, normalizeSave, persistSave, todayKey } from '../src/core/storage';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();

describe('開始時スター', () => {
  it('新規セーブは STARTING_STARS(30) で始まる', () => {
    const s = createNewSave(T0);
    expect(STARTING_STARS).toBe(30);
    expect(s.stars).toBe(30);
    expect(s.totalEarnedStars).toBe(0);
    expect(s.totalSpentStars).toBe(0);
  });

  it('既存セーブの stars: 0 は 30 に上書きされない', () => {
    const existing = { ...createNewSave(T0), stars: 0 };
    expect(normalizeSave(existing, T0).stars).toBe(0);
  });
});

describe('保存データ v2（座標の区画）', () => {
  const house2 = { type: 'house', level: 2, builtAt: T0, upgradedAt: T0 };
  const park1 = { type: 'park', level: 1, builtAt: T0, upgradedAt: T0 };

  it('新規セーブは最初の6区画を持ち、まだ土地を買っていない', () => {
    const s = createNewSave(T0);
    expect(s.version).toBe(2);
    expect([...s.land].sort()).toEqual([...INITIAL_CELLS].sort());
    expect(s.landPurchases).toBe(0);
  });

  it('v1 のセーブを v2 に移す（位置・レベル・星を保つ）', () => {
    const s = normalizeSave({ version: 1, stars: 77, buildings: { '0': house2, '4': park1 } }, T0);
    expect(s.version).toBe(2);
    expect([...s.land].sort()).toEqual([...INITIAL_CELLS].sort());
    expect(s.buildings['0,0']?.level).toBe(2);
    expect(s.buildings['1,1']?.type).toBe('park');
    expect(Object.keys(s.buildings).sort()).toEqual(['0,0', '1,1']);
    expect(s.stars).toBe(77);
    expect(s.landPurchases).toBe(0);
  });

  it('v2 は normalize を2回通しても同じ', () => {
    const once = normalizeSave({ version: 1, stars: 77, buildings: { '0': house2, '4': park1 } }, T0);
    const twice = normalizeSave(JSON.parse(JSON.stringify(once)), T0);
    expect(twice).toEqual(once);
  });

  it('壊れた土地データを捨て、持っていない土地の上の建物も捨てる', () => {
    const s = normalizeSave(
      { version: 2, land: ['0,0', '1.5,2', 'a,b', '0,0', '3,0', 7], landPurchases: 1, buildings: { '9,9': house2, '3,0': park1 } },
      T0,
    );
    expect(s.land).not.toContain('1.5,2');
    expect(s.land).not.toContain('a,b');
    expect(new Set(s.land).size).toBe(s.land.length);
    for (const c of INITIAL_CELLS) expect(s.land).toContain(c);
    expect(s.land).toContain('3,0');
    expect(s.buildings['9,9']).toBeUndefined();
    expect(s.buildings['3,0']?.type).toBe('park');
    expect(s.landPurchases).toBe(1);
  });

  it('land が空でも最初の6区画は残る', () => {
    const s = normalizeSave({ version: 2, land: [], buildings: {} }, T0);
    expect([...s.land].sort()).toEqual([...INITIAL_CELLS].sort());
  });
});

describe('normalizeSave', () => {
  it('null でも初期データを返す', () => {
    const s = normalizeSave(null, T0);
    expect(s.stars).toBe(30);
    expect(s.buildings).toEqual({});
    expect(s.playerId).toMatch(/^p_/);
  });

  it('足りない項目を初期値で補う', () => {
    const s = normalizeSave({ stars: 42 }, T0);
    expect(s.stars).toBe(42);
    expect(s.focusCount).toBe(0);
    expect(s.settings.soundOn).toBe(true);
    expect(s.claimedSessionIds).toEqual([]);
  });

  it('おかしな値を安全な値に直す', () => {
    const s = normalizeSave(
      {
        stars: -100,
        totalEarnedStars: 'abc',
        focusCount: Number.NaN,
        settings: { soundOn: 'yes', volume: 9 },
      },
      T0,
    );
    expect(s.stars).toBe(0);
    expect(s.totalEarnedStars).toBe(0);
    expect(s.focusCount).toBe(0);
    expect(s.settings.soundOn).toBe(true);
    expect(s.settings.volume).toBe(1);
  });

  it('知らない建物・範囲外のレベル・存在しない区画を捨てる', () => {
    const s = normalizeSave(
      {
        buildings: {
          '0': { type: 'house', level: 99 },
          '1': { type: 'castle', level: 2 },
          '9': { type: 'park', level: 1 },
          '2': { type: 'park', level: 0 },
          '3': 'こわれたデータ',
        },
      },
      T0,
    );
    expect(s.buildings['0,0']?.level).toBe(3);
    expect(s.buildings['1,0']).toBeUndefined();
    expect(s.buildings['2,0']?.level).toBe(1);
    expect(s.buildings['0,1']).toBeUndefined();
    expect(Object.keys(s.buildings)).toEqual(['0,0', '2,0']);
  });

  it('壊れたセッションは捨てる', () => {
    expect(normalizeSave({ session: { id: '', startedAt: 1 } }, T0).session).toBeNull();
    expect(normalizeSave({ session: { id: 'a', startedAt: 100, endsAt: 50 } }, T0).session).toBeNull();
  });

  it('正しいセッションは残す（ブラウザを閉じたあとの復元に使う）', () => {
    const session = normalizeSave(
      { session: { id: 'a', startedAt: T0, endsAt: T0 + 300_000, plannedMinutes: 5, plannedMs: 300_000 } },
      T0,
    ).session;
    expect(session?.id).toBe('a');
    expect(session?.endsAt).toBe(T0 + 300_000);
    expect(session?.status).toBe('running');
  });

  it('受け取り済みIDは文字列だけを残す', () => {
    const s = normalizeSave({ claimedSessionIds: ['a', 1, null, 'b'] }, T0);
    expect(s.claimedSessionIds).toEqual(['a', 'b']);
  });

  it('アンケートの選択肢以外の値は null にする', () => {
    const s = normalizeSave({ survey: { fun: 4, reuse: 'maybe', prefer: 'town', usability: 5, comment: 'ok' } }, T0);
    expect(s.survey?.reuse).toBeNull();
    expect(s.survey?.prefer).toBe('town');
    expect(s.survey?.fun).toBe(4);
  });
});

describe('loadSave / persistSave', () => {
  it('保存した内容を読み戻せる', () => {
    const storage = createMemoryStorage();
    const save = createNewSave(T0);
    save.stars = 70;
    save.buildings['0,0'] = { type: 'shop', level: 2, builtAt: T0, upgradedAt: T0 };
    persistSave(storage, save);

    const loaded = loadSave(storage, T0 + 1000);
    expect(loaded.isNew).toBe(false);
    expect(loaded.save.stars).toBe(70);
    expect(loaded.save.buildings['0,0']?.type).toBe('shop');
    expect(loaded.save.playerId).toBe(save.playerId);
  });

  it('保存が無ければ新規として扱う', () => {
    const loaded = loadSave(createMemoryStorage(), T0);
    expect(loaded.isNew).toBe(true);
    expect(loaded.wasRepaired).toBe(false);
  });

  it('壊れたJSONでも落ちず、元データを退避して作り直す', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.save, '{壊れている');
    const loaded = loadSave(storage, T0);
    expect(loaded.save.stars).toBe(STARTING_STARS); // 作り直したデータは新規扱い
    expect(loaded.wasRepaired).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.save + ':broken')).toBe('{壊れている');
  });

  it('正しい v1 のセーブは、移行しても修復扱いにならない', () => {
    const storage = createMemoryStorage();
    const v1: Record<string, unknown> = { ...createNewSave(T0), version: 1 };
    delete v1.land;
    delete v1.landPurchases;
    v1.buildings = { '0': { type: 'house', level: 2, builtAt: T0, upgradedAt: T0 } };
    storage.setItem(STORAGE_KEYS.save, JSON.stringify(v1));
    const loaded = loadSave(storage, T0);
    expect(loaded.save.buildings['0,0']?.level).toBe(2);
    expect(loaded.wasRepaired).toBe(false);
  });

  it('一部が欠けたデータは修復フラグが立つ', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.save, JSON.stringify({ stars: 10 }));
    const loaded = loadSave(storage, T0);
    expect(loaded.save.stars).toBe(10);
    expect(loaded.wasRepaired).toBe(true);
  });
});

describe('todayKey', () => {
  it('YYYY-MM-DD を返す', () => {
    expect(todayKey(T0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
