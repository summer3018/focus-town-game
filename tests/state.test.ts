import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/state';
import { readLog } from '../src/core/analytics';
import { createMemoryStorage, persistSave } from '../src/core/storage';
import type { StorageLike } from '../src/core/storage';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();
const MIN = 60_000;

function freshStore(storage: StorageLike = createMemoryStorage()): GameStore {
  return new GameStore(storage, T0);
}

describe('集中セッションの流れ', () => {
  it('開始 → 完了で報酬が入り、セッションが消える', () => {
    const store = freshStore();
    store.startFocus(5, T0);
    expect(store.save.session).not.toBeNull();
    expect(store.save.stars).toBe(0);

    expect(store.completeFocusIfDue(T0 + 4 * MIN)).toBeNull();
    expect(store.save.stars).toBe(0);

    const reward = store.completeFocusIfDue(T0 + 5 * MIN);
    expect(reward?.stars).toBe(10);
    expect(store.save.stars).toBe(10);
    expect(store.save.session).toBeNull();
    expect(store.save.focusCount).toBe(1);
  });

  it('完了処理を何度呼んでも報酬は一度だけ', () => {
    const store = freshStore();
    store.startFocus(25, T0);
    store.completeFocusIfDue(T0 + 25 * MIN);
    store.completeFocusIfDue(T0 + 25 * MIN);
    store.completeFocusIfDue(T0 + 26 * MIN);
    expect(store.save.stars).toBe(50);
    expect(store.save.focusCount).toBe(1);
  });

  it('再読み込みしても、同じセッションの報酬は二重に入らない', () => {
    const storage = createMemoryStorage();
    const first = freshStore(storage);
    first.startFocus(15, T0);

    // タイマー終了後にページを再読み込みした想定
    const second = new GameStore(storage, T0 + 15 * MIN);
    const reward = second.completeFocusIfDue(T0 + 15 * MIN);
    expect(reward?.stars).toBe(30);
    expect(second.save.stars).toBe(30);

    // さらにもう一度読み込んでも増えない
    const third = new GameStore(storage, T0 + 16 * MIN);
    expect(third.completeFocusIfDue(T0 + 16 * MIN)).toBeNull();
    expect(third.save.stars).toBe(30);
    expect(third.save.focusCount).toBe(1);
  });

  it('ブラウザを閉じている間に終わっていた場合も、復帰時に1回だけ受け取れる', () => {
    const storage = createMemoryStorage();
    const first = freshStore(storage);
    first.startFocus(5, T0);

    // 3時間後にアプリを開き直した
    const later = new GameStore(storage, T0 + 3 * 60 * MIN);
    expect(later.save.session?.id).toBe(first.save.session?.id);
    const reward = later.completeFocusIfDue(T0 + 3 * 60 * MIN);
    expect(reward?.stars).toBe(10);
    expect(reward?.actualMs).toBe(5 * MIN);
    expect(later.save.session).toBeNull();
  });

  it('中断では報酬が入らず、中断回数だけ増える', () => {
    const store = freshStore();
    store.startFocus(25, T0);
    store.cancelFocus(T0 + 3 * MIN);
    expect(store.save.stars).toBe(0);
    expect(store.save.focusCount).toBe(0);
    expect(store.save.focusCancelCount).toBe(1);
    expect(store.save.session).toBeNull();
  });

  it('中断したセッションの報酬は、あとから受け取れない', () => {
    const storage = createMemoryStorage();
    const store = freshStore(storage);
    store.startFocus(5, T0);
    store.cancelFocus(T0 + MIN);
    const reopened = new GameStore(storage, T0 + 10 * MIN);
    expect(reopened.completeFocusIfDue(T0 + 10 * MIN)).toBeNull();
    expect(reopened.save.stars).toBe(0);
  });

  it('集中時間は1〜60分に収まる', () => {
    const store = freshStore();
    store.startFocus(999, T0);
    expect(store.save.session?.plannedMinutes).toBe(60);
    store.cancelFocus(T0);
    store.startFocus(0, T0);
    expect(store.save.session?.plannedMinutes).toBe(1);
  });
});

describe('街づくり', () => {
  it('建設と強化でスター残高が正しく動く', () => {
    const store = freshStore();
    store.startFocus(25, T0);
    store.completeFocusIfDue(T0 + 25 * MIN); // +50
    expect(store.save.stars).toBe(50);

    expect(store.construct(0, 'house', T0)).toBe(true);
    expect(store.save.stars).toBe(30);
    expect(store.upgradeSlot(0, T0)).toBe(true); // -30
    expect(store.save.stars).toBe(0);
    expect(store.save.buildings[0]?.level).toBe(2);

    expect(store.upgradeSlot(0, T0)).toBe(false);
    expect(store.save.stars).toBe(0);
    expect(store.save.buildings[0]?.level).toBe(2);
  });

  it('足りないのに建てようとしても残高は減らない', () => {
    const store = freshStore();
    expect(store.construct(0, 'shop', T0)).toBe(false);
    expect(store.save.stars).toBe(0);
    expect(store.save.totalSpentStars).toBe(0);
  });
});

describe('プレイログ', () => {
  it('ひと通り遊ぶと必要なイベントが記録される', () => {
    const storage = createMemoryStorage();
    const store = new GameStore(storage, T0);
    store.recordStartup(T0);
    store.startFocus(25, T0); // 50★ たまるので家（20★）を建てられる
    store.completeFocusIfDue(T0 + 25 * MIN);
    expect(store.construct(0, 'house', T0)).toBe(true);
    store.startMinigame();
    store.finishMinigame(430, 12);

    const names = readLog(storage).map((e) => e.name);
    expect(names).toContain('game_start');
    expect(names).toContain('focus_start');
    expect(names).toContain('focus_complete');
    expect(names).toContain('reward_claim');
    expect(names).toContain('building_construct');
    expect(names).toContain('minigame_start');
    expect(names).toContain('minigame_complete');
  });

  it('建設・強化のイベントには、その回に使ったスターが記録される', () => {
    const storage = createMemoryStorage();
    const store = new GameStore(storage, T0);
    store.save.stars = 500;
    store.construct(0, 'shop', T0); // 30★
    store.upgradeSlot(0, T0); // 45★
    const log = readLog(storage);
    const construct = log.find((e) => e.name === 'building_construct');
    const upgrade = log.find((e) => e.name === 'building_upgrade');
    expect(construct?.starsSpent).toBe(30);
    expect(upgrade?.starsSpent).toBe(45);
    expect(upgrade?.buildingLevel).toBe(2);
  });

  it('日付が変わってから開くと return_visit が記録される', () => {
    const storage = createMemoryStorage();
    const first = new GameStore(storage, T0);
    first.recordStartup(T0);
    expect(readLog(storage).filter((e) => e.name === 'return_visit').length).toBe(0);

    const nextDay = T0 + 26 * 60 * MIN;
    const second = new GameStore(storage, nextDay);
    second.recordStartup(nextDay);
    expect(readLog(storage).filter((e) => e.name === 'return_visit').length).toBe(1);
  });
});

describe('設定とリセット', () => {
  it('音の設定が保存される', () => {
    const storage = createMemoryStorage();
    const store = new GameStore(storage, T0);
    store.setSound(false);
    store.setVolume(0.6);
    const reopened = new GameStore(storage, T0);
    expect(reopened.save.settings.soundOn).toBe(false);
    expect(reopened.save.settings.volume).toBeCloseTo(0.6, 5);
  });

  it('リセットすると街とスターが消え、匿名IDは残る', () => {
    const storage = createMemoryStorage();
    const store = new GameStore(storage, T0);
    const id = store.save.playerId;
    store.startFocus(25, T0);
    store.completeFocusIfDue(T0 + 25 * MIN);
    store.construct(0, 'house', T0);
    store.resetAll(T0);
    expect(store.save.stars).toBe(0);
    expect(store.save.buildings).toEqual({});
    expect(store.save.focusCount).toBe(0);
    expect(store.save.playerId).toBe(id);
    expect(readLog(storage).length).toBe(0);
  });
});

describe('壊れた保存データからの復帰', () => {
  it('読めないデータでも起動でき、遊べる状態になる', () => {
    const storage = createMemoryStorage();
    storage.setItem('focus-town:save:v1', '{{{');
    const store = new GameStore(storage, T0);
    expect(store.wasRepaired).toBe(true);
    store.startFocus(5, T0);
    expect(store.completeFocusIfDue(T0 + 5 * MIN)?.stars).toBe(10);
  });

  it('スターだけ書き換えられた不正なデータも安全な値に直る', () => {
    const storage = createMemoryStorage();
    const seed = new GameStore(createMemoryStorage(), T0).save;
    seed.stars = -999;
    persistSave(storage, seed);
    const store = new GameStore(storage, T0);
    expect(store.save.stars).toBe(0);
  });
});
