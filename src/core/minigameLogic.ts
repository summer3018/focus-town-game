/**
 * ミニゲーム「スターキャッチ」のルール部分。
 * 描画から切り離して、そのままテストできるようにしてある。
 */
import { MINIGAME } from './config';

export type StarSize = 'normal' | 'small';

export interface StarTarget {
  id: number;
  /** 0〜1 の相対座標（描画側で画面サイズを掛ける） */
  x: number;
  y: number;
  size: StarSize;
  /** 出現時刻（ゲーム内経過ms） */
  bornAt: number;
  /** 表示時間（ms） */
  lifetimeMs: number;
  /** 取られたか */
  taken: boolean;
}

export interface MinigameState {
  elapsedMs: number;
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  stars: StarTarget[];
  finished: boolean;
  /** 直近に発生した演出イベント（描画側が読んで消す） */
  fanfare: boolean;
}

export interface HitResult {
  hit: boolean;
  gained: number;
  combo: number;
  multiplier: number;
  starId: number | null;
  fanfare: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** コンボ倍率 */
export function comboMultiplier(combo: number): number {
  const steps = Math.floor(Math.max(0, combo) / MINIGAME.comboStep);
  return Math.min(MINIGAME.comboMaxMultiplier, 1 + steps * MINIGAME.comboBonus);
}

/** 経過に応じて星の表示時間は短くなる */
export function lifetimeAt(elapsedMs: number): number {
  const t = elapsedMs / MINIGAME.durationMs;
  return Math.round(lerp(MINIGAME.lifetimeStartMs, MINIGAME.lifetimeEndMs, t));
}

export function spawnIntervalAt(elapsedMs: number): number {
  const t = elapsedMs / MINIGAME.durationMs;
  return Math.round(lerp(MINIGAME.spawnIntervalStartMs, MINIGAME.spawnIntervalEndMs, t));
}

export function maxConcurrentAt(elapsedMs: number): number {
  const t = elapsedMs / MINIGAME.durationMs;
  return Math.round(lerp(MINIGAME.maxConcurrentStart, MINIGAME.maxConcurrentEnd, t));
}

export function createMinigameState(): MinigameState {
  return {
    elapsedMs: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    stars: [],
    finished: false,
    fanfare: false,
  };
}

export class Minigame {
  state: MinigameState = createMinigameState();
  private nextId = 1;
  private spawnTimer = 0;
  private rand: () => number;
  /** 直前の出現位置。近すぎる位置に続けて出さないために覚えておく */
  private lastPos = { x: 0.5, y: 0.5 };

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
  }

  reset(): void {
    this.state = createMinigameState();
    this.nextId = 1;
    this.spawnTimer = 0;
    this.lastPos = { x: 0.5, y: 0.5 };
  }

  /** dt ミリ秒ぶん進める */
  update(dtMs: number): void {
    const s = this.state;
    if (s.finished) return;
    s.elapsedMs = Math.min(MINIGAME.durationMs, s.elapsedMs + Math.max(0, dtMs));

    // 時間切れの星を片付ける（取り逃しはコンボが切れる）
    const alive: StarTarget[] = [];
    for (const star of s.stars) {
      if (star.taken) continue;
      if (s.elapsedMs - star.bornAt >= star.lifetimeMs) {
        s.misses += 1;
        s.combo = 0;
        continue;
      }
      alive.push(star);
    }
    s.stars = alive;

    if (s.elapsedMs >= MINIGAME.durationMs) {
      s.finished = true;
      s.stars = [];
      return;
    }

    this.spawnTimer += Math.max(0, dtMs);
    const interval = spawnIntervalAt(s.elapsedMs);
    while (this.spawnTimer >= interval && s.stars.length < maxConcurrentAt(s.elapsedMs)) {
      this.spawnTimer -= interval;
      this.spawn();
    }
  }

  private spawn(): void {
    const s = this.state;
    // 直前の位置から一定以上離れた場所に出す（同じ所を連打させない）
    let x = 0.5;
    let y = 0.5;
    for (let i = 0; i < 8; i += 1) {
      x = 0.1 + this.rand() * 0.8;
      y = 0.12 + this.rand() * 0.76;
      const dx = x - this.lastPos.x;
      const dy = y - this.lastPos.y;
      if (Math.hypot(dx, dy) > 0.28) break;
    }
    this.lastPos = { x, y };
    const small = this.rand() < 0.25;
    s.stars.push({
      id: this.nextId++,
      x,
      y,
      size: small ? 'small' : 'normal',
      bornAt: s.elapsedMs,
      lifetimeMs: Math.round(lifetimeAt(s.elapsedMs) * (small ? 0.75 : 1)),
      taken: false,
    });
  }

  /**
   * 画面をタップしたときの判定。
   * 相対座標(0〜1)と、当たり判定の半径(相対値)を受け取る。
   * 何も無い所を叩くとコンボが切れる＝連打が最適解にならない。
   */
  tap(x: number, y: number, radius: number): HitResult {
    const s = this.state;
    if (s.finished) {
      return { hit: false, gained: 0, combo: s.combo, multiplier: 1, starId: null, fanfare: false };
    }

    let target: StarTarget | null = null;
    let bestDist = Infinity;
    for (const star of s.stars) {
      if (star.taken) continue;
      const r = star.size === 'small' ? radius * 0.75 : radius;
      const d = Math.hypot(star.x - x, star.y - y);
      if (d <= r && d < bestDist) {
        bestDist = d;
        target = star;
      }
    }

    if (!target) {
      s.combo = 0;
      return { hit: false, gained: 0, combo: 0, multiplier: 1, starId: null, fanfare: false };
    }

    target.taken = true;
    s.stars = s.stars.filter((star) => star.id !== target!.id);
    s.hits += 1;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);

    const multiplier = comboMultiplier(s.combo);
    const sizeBonus = target.size === 'small' ? MINIGAME.smallStarMultiplier : 1;
    const gained = Math.round(MINIGAME.baseScore * multiplier * sizeBonus);
    s.score += gained;

    const fanfare = s.combo > 0 && s.combo % MINIGAME.fanfareCombo === 0;
    s.fanfare = s.fanfare || fanfare;

    return { hit: true, gained, combo: s.combo, multiplier, starId: target.id, fanfare };
  }

  get remainingMs(): number {
    return Math.max(0, MINIGAME.durationMs - this.state.elapsedMs);
  }
}

/** 結果の評価（演出の出し分けに使う） */
export function rankFor(score: number): { rank: string; message: string; great: boolean } {
  if (score >= MINIGAME.greatScore) {
    return { rank: 'S', message: '見事なキャッチ。いい休憩になりました。', great: true };
  }
  if (score >= 500) return { rank: 'A', message: 'いい調子。頭が切り替わりました。', great: false };
  if (score >= 250) return { rank: 'B', message: 'ほどよく動けました。', great: false };
  return { rank: 'C', message: 'ひと息つけましたか。', great: false };
}
