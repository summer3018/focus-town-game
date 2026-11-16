/** 街の上に重ねる短い演出（建設の土煙・レベルアップの光・スター獲得） */

export type EffectKind = 'dust' | 'sparkle' | 'star' | 'ring' | 'text';

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  bornAt: number;
  durationMs: number;
  vx: number;
  vy: number;
  color: string;
  text?: string;
  size: number;
}

export class EffectLayer {
  private effects: Effect[] = [];

  get count(): number {
    return this.effects.length;
  }

  clear(): void {
    this.effects = [];
  }

  add(e: Omit<Effect, 'bornAt'>, now: number): void {
    if (this.effects.length > 160) this.effects.splice(0, this.effects.length - 160);
    this.effects.push({ ...e, bornAt: now });
  }

  /** 建設時の土煙 */
  burstDust(x: number, y: number, now: number, rand: () => number = Math.random): void {
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + rand() * 0.4;
      this.add(
        {
          kind: 'dust',
          x,
          y,
          vx: Math.cos(angle) * (0.016 + rand() * 0.02),
          vy: Math.sin(angle) * 0.008 - 0.012,
          durationMs: 520 + rand() * 180,
          color: '#cdbba6',
          size: 1 + Math.round(rand() * 2),
        },
        now,
      );
    }
  }

  /** レベルアップのきらめき */
  burstSparkle(x: number, y: number, now: number, rand: () => number = Math.random): void {
    this.add({ kind: 'ring', x, y, vx: 0, vy: 0, durationMs: 620, color: '#ffe79a', size: 4 }, now);
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      this.add(
        {
          kind: 'sparkle',
          x,
          y: y - 10,
          vx: Math.cos(angle) * 0.035,
          vy: Math.sin(angle) * 0.03 - 0.015,
          durationMs: 700 + rand() * 200,
          color: i % 2 === 0 ? '#ffd766' : '#fff4c9',
          size: 2,
        },
        now,
      );
    }
  }

  /** スター獲得が街に降る演出 */
  rainStars(count: number, now: number, width: number, rand: () => number = Math.random): void {
    const n = Math.min(14, Math.max(4, Math.round(count / 4)));
    for (let i = 0; i < n; i += 1) {
      this.add(
        {
          kind: 'star',
          x: 16 + rand() * (width - 32),
          y: -8 - rand() * 40,
          vx: 0,
          vy: 0.055 + rand() * 0.03,
          durationMs: 1500 + rand() * 600,
          color: '#ffd766',
          size: 2 + Math.round(rand() * 2),
        },
        now,
      );
    }
  }

  floatText(x: number, y: number, text: string, color: string, now: number): void {
    this.add({ kind: 'text', x, y, vx: 0, vy: -0.016, durationMs: 900, color, text, size: 7 }, now);
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const alive: Effect[] = [];
    for (const e of this.effects) {
      const age = now - e.bornAt;
      if (age >= e.durationMs) continue;
      alive.push(e);
      const t = age / e.durationMs;
      const x = e.x + e.vx * age;
      const y = e.y + e.vy * age + (e.kind === 'dust' ? 0.00004 * age * age : 0);
      ctx.save();
      ctx.globalAlpha = e.kind === 'star' ? Math.min(1, 2 - t * 2) : 1 - t;

      if (e.kind === 'ring') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, e.size + t * 22, (e.size + t * 22) * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'text' && e.text) {
        ctx.fillStyle = e.color;
        ctx.font = 'bold 8px "DotGothic16", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.text, x, y);
      } else if (e.kind === 'star') {
        drawPixelStar(ctx, x, y, e.size, e.color);
      } else if (e.kind === 'sparkle') {
        ctx.fillStyle = e.color;
        ctx.fillRect(Math.round(x), Math.round(y), e.size, e.size);
        ctx.fillRect(Math.round(x) - e.size, Math.round(y), e.size, e.size * 0.5);
      } else {
        ctx.fillStyle = e.color;
        ctx.fillRect(Math.round(x), Math.round(y), e.size, e.size);
      }
      ctx.restore();
    }
    this.effects = alive;
  }
}

/** ドット絵風の小さな星 */
export function drawPixelStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = color;
  ctx.fillRect(px - s, py, s * 2 + 1, 1);
  ctx.fillRect(px, py - s, 1, s * 2 + 1);
  if (s >= 2) {
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
}
