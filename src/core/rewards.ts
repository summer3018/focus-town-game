/**
 * 集中報酬の計算と受け取り。
 * 「同じセッションで二度受け取れない」ことをこのファイルで保証する。
 */
import { MAX_CLAIMED_HISTORY, PRESET_REWARDS, STARS_PER_MINUTE } from './config';
import type { FocusSession, RewardResult, SaveData } from './types';

/** 集中時間（分）から獲得スターを求める */
export function rewardForMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  const rounded = Math.round(minutes);
  const preset = PRESET_REWARDS[rounded];
  if (typeof preset === 'number') return preset;
  return rounded * STARS_PER_MINUTE;
}

/** そのセッションの報酬を受け取り済みか */
export function isClaimed(save: SaveData, sessionId: string): boolean {
  return save.claimedSessionIds.includes(sessionId);
}

/**
 * 報酬を受け取る。
 * - タイマーが終了予定時刻に達していないセッションには付与しない
 * - 既に受け取り済みのセッションには二度目を付与しない（null を返す）
 * 成功時は save を更新して RewardResult を返す。
 */
export function claimReward(save: SaveData, session: FocusSession, now: number): RewardResult | null {
  if (now < session.endsAt) return null;
  if (session.status === 'cancelled') return null;
  if (isClaimed(save, session.id)) return null;

  const stars = rewardForMinutes(session.plannedMinutes);
  const result: RewardResult = {
    sessionId: session.id,
    stars,
    plannedMinutes: session.plannedMinutes,
    actualMs: Math.max(0, Math.min(now - session.startedAt, session.plannedMs)),
    claimedAt: now,
  };

  save.stars += stars;
  save.totalEarnedStars += stars;
  save.focusCount += 1;
  save.totalFocusMs += session.plannedMs;
  save.claimedSessionIds.push(session.id);
  if (save.claimedSessionIds.length > MAX_CLAIMED_HISTORY) {
    save.claimedSessionIds.splice(0, save.claimedSessionIds.length - MAX_CLAIMED_HISTORY);
  }
  save.lastReward = result;
  return result;
}

/** 一意なセッションIDを作る（端末内でのみ使う。個人情報は含まない） */
export function createSessionId(now: number, rand: () => number = Math.random): string {
  const suffix = Math.floor(rand() * 1_000_000).toString(36);
  return `s_${now.toString(36)}_${suffix}`;
}
