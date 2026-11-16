/**
 * 集中タイマーの計算。
 * 描画フレーム数ではなく「開始時刻・終了予定時刻」と現在時刻だけで決まる純粋関数にしてある。
 * そのためバックグラウンド復帰・再読み込みでも同じ結果になる。
 */
import type { FocusSession } from './types';

export interface TimerView {
  /** 残り時間（ms・0未満にはならない） */
  remainingMs: number;
  /** 経過時間（ms・0未満にはならない。予定時間を超えても伸び続けない） */
  elapsedMs: number;
  /** 実際に経過した生の時間（ms・予定を超えたぶんも含む） */
  rawElapsedMs: number;
  /** 進捗 0〜1 */
  progress: number;
  /** 終了予定時刻に達したか */
  isFinished: boolean;
}

export function minutesToMs(minutes: number): number {
  return Math.round(minutes * 60_000);
}

/** 新しい集中セッションを作る */
export function createSession(minutes: number, now: number, id: string): FocusSession {
  const plannedMs = minutesToMs(minutes);
  return {
    id,
    plannedMinutes: minutes,
    plannedMs,
    startedAt: now,
    endsAt: now + plannedMs,
    status: 'running',
  };
}

/** 現在時刻からタイマーの表示状態を求める */
export function timerView(session: FocusSession, now: number): TimerView {
  const rawElapsedMs = Math.max(0, now - session.startedAt);
  const remainingMs = Math.max(0, session.endsAt - now);
  const elapsedMs = Math.min(session.plannedMs, rawElapsedMs);
  const progress = session.plannedMs > 0 ? Math.min(1, Math.max(0, elapsedMs / session.plannedMs)) : 1;
  return {
    remainingMs,
    elapsedMs,
    rawElapsedMs,
    progress,
    isFinished: now >= session.endsAt,
  };
}

/** mm:ss 表示（60分以上は h:mm:ss） */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 「14:30」のような時刻表示 */
export function formatClock(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 「1時間23分」のような累計表示 */
export function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}分`;
  return `${h}時間${m}分`;
}

/** 分の値を有効な範囲に丸める */
export function clampMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
