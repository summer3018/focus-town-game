import { describe, expect, it } from 'vitest';
import { MINIGAME } from '../src/core/config';
import { Minigame, comboMultiplier, lifetimeAt, rankFor, spawnIntervalAt } from '../src/core/minigameLogic';

/** テスト用の決まった乱数 */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('コンボ倍率', () => {
  it('5コンボごとに上がり、上限で止まる', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(100)).toBe(MINIGAME.comboMaxMultiplier);
  });
});

describe('難易度の変化', () => {
  it('後半ほど星の表示時間が短くなる', () => {
    expect(lifetimeAt(0)).toBe(MINIGAME.lifetimeStartMs);
    expect(lifetimeAt(MINIGAME.durationMs)).toBe(MINIGAME.lifetimeEndMs);
    expect(lifetimeAt(MINIGAME.durationMs / 2)).toBeLessThan(MINIGAME.lifetimeStartMs);
  });

  it('後半ほど出現間隔が短くなる', () => {
    expect(spawnIntervalAt(0)).toBeGreaterThan(spawnIntervalAt(MINIGAME.durationMs));
  });
});

describe('Minigame', () => {
  it('星が出現し、同時表示数の上限を超えない', () => {
    const g = new Minigame(seeded());
    for (let i = 0; i < 100; i += 1) g.update(100);
    expect(g.state.stars.length).toBeLessThanOrEqual(MINIGAME.maxConcurrentEnd);
    expect(g.state.stars.length).toBeGreaterThan(0);
  });

  it('星をタップすると得点が入り、コンボが伸びる', () => {
    const g = new Minigame(seeded());
    g.update(700);
    const star = g.state.stars[0];
    expect(star).toBeDefined();
    const r = g.tap(star.x, star.y, 0.1);
    expect(r.hit).toBe(true);
    expect(r.gained).toBeGreaterThan(0);
    expect(g.state.score).toBe(r.gained);
    expect(g.state.combo).toBe(1);
    expect(g.state.stars.find((s) => s.id === star.id)).toBeUndefined();
  });

  it('何も無い所を叩くとコンボが切れる（連打が最適解にならない）', () => {
    const g = new Minigame(seeded());
    g.update(700);
    const star = g.state.stars[0];
    g.tap(star.x, star.y, 0.1);
    expect(g.state.combo).toBe(1);
    const miss = g.tap(-1, -1, 0.1);
    expect(miss.hit).toBe(false);
    expect(miss.gained).toBe(0);
    expect(g.state.combo).toBe(0);
  });

  it('取り逃すとコンボが切れて misses が増える', () => {
    const g = new Minigame(seeded());
    g.update(700);
    const star = g.state.stars[0];
    g.tap(star.x, star.y, 0.1);
    expect(g.state.combo).toBe(1);

    // 次の星を出したうえで、取らずに表示時間を過ぎさせる
    g.update(700);
    expect(g.state.stars.length).toBeGreaterThan(0);
    g.update(MINIGAME.lifetimeStartMs + 200);
    expect(g.state.misses).toBeGreaterThan(0);
    expect(g.state.combo).toBe(0);
  });

  it('コンボが続くほど1回あたりの得点が増える', () => {
    const g = new Minigame(seeded(7));
    let firstGain = 0;
    let lastGain = 0;
    for (let i = 0; i < 40; i += 1) {
      g.update(200);
      const star = g.state.stars.find((s) => s.size === 'normal');
      if (!star) continue;
      const r = g.tap(star.x, star.y, 0.12);
      if (r.hit) {
        if (!firstGain) firstGain = r.gained;
        lastGain = r.gained;
      }
    }
    expect(g.state.bestCombo).toBeGreaterThanOrEqual(MINIGAME.comboStep);
    expect(lastGain).toBeGreaterThan(firstGain);
  });

  it('60秒で終わり、それ以上進まない', () => {
    const g = new Minigame(seeded());
    for (let i = 0; i < 700; i += 1) g.update(100);
    expect(g.state.finished).toBe(true);
    expect(g.state.elapsedMs).toBe(MINIGAME.durationMs);
    expect(g.remainingMs).toBe(0);
    const scoreAtEnd = g.state.score;
    const r = g.tap(0.5, 0.5, 0.2);
    expect(r.hit).toBe(false);
    expect(g.state.score).toBe(scoreAtEnd);
  });

  it('reset で最初からやり直せる', () => {
    const g = new Minigame(seeded());
    g.update(5000);
    g.reset();
    expect(g.state.score).toBe(0);
    expect(g.state.elapsedMs).toBe(0);
    expect(g.state.stars).toEqual([]);
    expect(g.state.finished).toBe(false);
  });

  it('10コンボごとに演出フラグが立つ', () => {
    const g = new Minigame(seeded(3));
    let sawFanfare = false;
    for (let i = 0; i < 80; i += 1) {
      g.update(150);
      for (const star of [...g.state.stars]) {
        const r = g.tap(star.x, star.y, 0.12);
        if (r.fanfare) sawFanfare = true;
      }
    }
    expect(sawFanfare).toBe(true);
  });
});

describe('rankFor', () => {
  it('スコアに応じて評価が変わる', () => {
    expect(rankFor(0).rank).toBe('C');
    expect(rankFor(300).rank).toBe('B');
    expect(rankFor(600).rank).toBe('A');
    expect(rankFor(MINIGAME.greatScore).rank).toBe('S');
    expect(rankFor(MINIGAME.greatScore).great).toBe(true);
  });
});
