import { describe, expect, it } from 'vitest';
import {
  clampMinutes,
  createSession,
  formatClock,
  formatDuration,
  formatTotalDuration,
  minutesToMs,
  timerView,
} from '../src/core/timer';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();

describe('createSession', () => {
  it('開始時刻と終了予定時刻を実時刻で保存する', () => {
    const s = createSession(25, T0, 'sid');
    expect(s.startedAt).toBe(T0);
    expect(s.endsAt).toBe(T0 + 25 * 60_000);
    expect(s.plannedMs).toBe(minutesToMs(25));
    expect(s.status).toBe('running');
  });
});

describe('timerView', () => {
  const s = createSession(5, T0, 'sid');

  it('開始直後は残り全部', () => {
    const v = timerView(s, T0);
    expect(v.remainingMs).toBe(5 * 60_000);
    expect(v.progress).toBe(0);
    expect(v.isFinished).toBe(false);
  });

  it('途中の進捗を実時刻から求める', () => {
    const v = timerView(s, T0 + 2 * 60_000);
    expect(v.remainingMs).toBe(3 * 60_000);
    expect(v.elapsedMs).toBe(2 * 60_000);
    expect(v.progress).toBeCloseTo(0.4, 5);
  });

  it('終了予定時刻ちょうどで完了になる', () => {
    const v = timerView(s, T0 + 5 * 60_000);
    expect(v.isFinished).toBe(true);
    expect(v.remainingMs).toBe(0);
    expect(v.progress).toBe(1);
  });

  it('バックグラウンドで長時間放置しても残りは0で止まり、進捗は1を超えない', () => {
    const v = timerView(s, T0 + 10 * 60 * 60_000);
    expect(v.remainingMs).toBe(0);
    expect(v.progress).toBe(1);
    expect(v.elapsedMs).toBe(5 * 60_000);
    expect(v.rawElapsedMs).toBe(10 * 60 * 60_000);
    expect(v.isFinished).toBe(true);
  });

  it('端末時刻が巻き戻っても負の値にならない', () => {
    const v = timerView(s, T0 - 60_000);
    expect(v.remainingMs).toBe(6 * 60_000);
    expect(v.elapsedMs).toBe(0);
    expect(v.progress).toBe(0);
    expect(v.isFinished).toBe(false);
  });

  it('描画されなくても経過時間は時刻の差だけで決まる', () => {
    const a = timerView(s, T0 + 61_000);
    const b = timerView(s, T0 + 61_000);
    expect(a).toEqual(b);
  });
});

describe('表示の整形', () => {
  it('mm:ss にする', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59_000)).toBe('00:59');
    expect(formatDuration(60_000)).toBe('01:00');
    expect(formatDuration(25 * 60_000)).toBe('25:00');
    expect(formatDuration(-5000)).toBe('00:00');
  });

  it('60分以上は h:mm:ss', () => {
    expect(formatDuration(60 * 60_000)).toBe('1:00:00');
  });

  it('端数は切り上げて「残り0秒」が一瞬で消えないようにする', () => {
    expect(formatDuration(1)).toBe('00:01');
    expect(formatDuration(1500)).toBe('00:02');
  });

  it('時刻表示', () => {
    expect(formatClock(T0)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('累計表示', () => {
    expect(formatTotalDuration(0)).toBe('0分');
    expect(formatTotalDuration(25 * 60_000)).toBe('25分');
    expect(formatTotalDuration(85 * 60_000)).toBe('1時間25分');
  });
});

describe('clampMinutes', () => {
  it('範囲に収める', () => {
    expect(clampMinutes(0, 1, 60)).toBe(1);
    expect(clampMinutes(61, 1, 60)).toBe(60);
    expect(clampMinutes(12.6, 1, 60)).toBe(13);
    expect(clampMinutes(Number.NaN, 1, 60)).toBe(1);
  });
});
