import { beforeEach, describe, expect, it } from 'vitest';
import { claimReward, createSessionId, isClaimed, rewardForMinutes } from '../src/core/rewards';
import { createNewSave } from '../src/core/storage';
import { createSession } from '../src/core/timer';
import { MAX_CLAIMED_HISTORY } from '../src/core/config';
import type { SaveData } from '../src/core/types';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();

describe('rewardForMinutes', () => {
  it('プリセットは設定表どおり', () => {
    expect(rewardForMinutes(5)).toBe(10);
    expect(rewardForMinutes(15)).toBe(30);
    expect(rewardForMinutes(25)).toBe(50);
  });

  it('カスタムは1分2スター', () => {
    expect(rewardForMinutes(1)).toBe(2);
    expect(rewardForMinutes(10)).toBe(20);
    expect(rewardForMinutes(60)).toBe(120);
  });

  it('おかしな値では0', () => {
    expect(rewardForMinutes(0)).toBe(0);
    expect(rewardForMinutes(-5)).toBe(0);
    expect(rewardForMinutes(Number.NaN)).toBe(0);
  });
});

describe('claimReward', () => {
  let save: SaveData;

  beforeEach(() => {
    save = createNewSave(T0);
    save.stars = 0; // 開始時スターを除いて、報酬の増え方だけを見る
  });

  it('完了していれば付与される', () => {
    const s = createSession(25, T0, 'sid-1');
    const r = claimReward(save, s, T0 + 25 * 60_000);
    expect(r).not.toBeNull();
    expect(r!.stars).toBe(50);
    expect(save.stars).toBe(50);
    expect(save.totalEarnedStars).toBe(50);
    expect(save.focusCount).toBe(1);
    expect(save.totalFocusMs).toBe(25 * 60_000);
  });

  it('終了予定時刻より前では付与されない', () => {
    const s = createSession(25, T0, 'sid-1');
    expect(claimReward(save, s, T0 + 24 * 60_000)).toBeNull();
    expect(save.stars).toBe(0);
    expect(save.focusCount).toBe(0);
  });

  it('同じセッションでは二度目が付与されない（再読み込み・画面遷移の重複対策）', () => {
    const s = createSession(5, T0, 'sid-dup');
    const first = claimReward(save, s, T0 + 5 * 60_000);
    const second = claimReward(save, s, T0 + 5 * 60_000 + 1);
    const third = claimReward(save, s, T0 + 60 * 60_000);
    expect(first!.stars).toBe(10);
    expect(second).toBeNull();
    expect(third).toBeNull();
    expect(save.stars).toBe(10);
    expect(save.focusCount).toBe(1);
    expect(save.claimedSessionIds).toEqual(['sid-dup']);
  });

  it('中断したセッションには付与されない', () => {
    const s = createSession(5, T0, 'sid-cancel');
    s.status = 'cancelled';
    expect(claimReward(save, s, T0 + 10 * 60_000)).toBeNull();
    expect(save.stars).toBe(0);
  });

  it('別のセッションなら別々に付与される', () => {
    const a = createSession(5, T0, 'a');
    const b = createSession(15, T0, 'b');
    claimReward(save, a, T0 + 5 * 60_000);
    claimReward(save, b, T0 + 15 * 60_000);
    expect(save.stars).toBe(40);
    expect(save.focusCount).toBe(2);
  });

  it('実際の経過時間は予定時間を超えて記録しない', () => {
    const s = createSession(5, T0, 'long');
    const r = claimReward(save, s, T0 + 3 * 60 * 60_000);
    expect(r!.actualMs).toBe(5 * 60_000);
  });

  it('受け取り済みIDは上限を超えて増え続けない', () => {
    for (let i = 0; i < MAX_CLAIMED_HISTORY + 30; i += 1) {
      const s = createSession(1, T0, 'id-' + i);
      claimReward(save, s, T0 + 60_000);
    }
    expect(save.claimedSessionIds.length).toBe(MAX_CLAIMED_HISTORY);
    expect(isClaimed(save, 'id-' + (MAX_CLAIMED_HISTORY + 29))).toBe(true);
    expect(isClaimed(save, 'id-0')).toBe(false);
  });

  it('lastReward に直近の結果が残る', () => {
    const s = createSession(15, T0, 'last');
    claimReward(save, s, T0 + 15 * 60_000);
    expect(save.lastReward?.sessionId).toBe('last');
    expect(save.lastReward?.stars).toBe(30);
  });
});

describe('createSessionId', () => {
  it('呼ぶたびに違うIDになる', () => {
    const ids = new Set<string>();
    let seed = 0;
    for (let i = 0; i < 50; i += 1) {
      seed += 0.019;
      ids.add(createSessionId(T0 + i, () => (seed % 1)));
    }
    expect(ids.size).toBe(50);
  });
});
