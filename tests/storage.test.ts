import { describe, expect, it } from 'vitest';
import { STARTING_STARS, STORAGE_KEYS } from '../src/core/config';
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
    expect(s.buildings[0]?.level).toBe(3);
    expect(s.buildings[1]).toBeUndefined();
    expect(s.buildings[2]?.level).toBe(1);
    expect(s.buildings[3]).toBeUndefined();
    expect(Object.keys(s.buildings)).toEqual(['0', '2']);
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
    save.buildings[0] = { type: 'shop', level: 2, builtAt: T0, upgradedAt: T0 };
    persistSave(storage, save);

    const loaded = loadSave(storage, T0 + 1000);
    expect(loaded.isNew).toBe(false);
    expect(loaded.save.stars).toBe(70);
    expect(loaded.save.buildings[0]?.type).toBe('shop');
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
