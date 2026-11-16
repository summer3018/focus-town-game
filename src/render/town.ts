/**
 * 街の描画。
 * 低い解像度（180×210）で描いて拡大することで、ドット絵らしい見た目にしている。
 */
import { SLOT_IDS } from '../core/config';
import type { SaveData, SlotId } from '../core/types';
import { buildingCount, townLevel } from '../core/buildings';
import { EffectLayer, drawPixelStar } from './effects';
import { PALETTE, drawBuilding } from './sprites';

export const LOGICAL_W = 180;
export const LOGICAL_H = 210;

const TILE_W = 48;
const TILE_H = 24;
const ORIGIN_X = 78;
const ORIGIN_Y = 112;

export interface SlotPos {
  slot: SlotId;
  x: number;
  y: number;
  depth: number;
}

export function slotPositions(): SlotPos[] {
  return SLOT_IDS.map((slot) => {
    const col = slot % 3;
    const row = Math.floor(slot / 3);
    return {
      slot,
      x: ORIGIN_X + (col - row) * (TILE_W / 2),
      y: ORIGIN_Y + (col + row) * (TILE_H / 2),
      depth: col + row,
    };
  });
}

/** 論理座標が、どの区画の上にあるか */
export function slotAt(lx: number, ly: number): SlotId | null {
  let found: SlotId | null = null;
  let bestDepth = -1;
  for (const p of slotPositions()) {
    const dx = Math.abs(lx - p.x) / (TILE_W / 2);
    const dy = Math.abs(ly - p.y) / (TILE_H / 2);
    if (dx + dy <= 1 && p.depth >= bestDepth) {
      bestDepth = p.depth;
      found = p.slot;
    }
  }
  return found;
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

export class TownRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly effects = new EffectLayer();
  private rafId = 0;
  private running = false;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  selectedSlot: SlotId | null = null;
  /** 建設・強化の直後に、その区画だけ一瞬大きくする */
  private popAnim = new Map<SlotId, { start: number; kind: 'build' | 'upgrade' }>();
  private getSave: () => SaveData;

  constructor(canvas: HTMLCanvasElement, getSave: () => SaveData) {
    this.canvas = canvas;
    this.getSave = getSave;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const s = Math.min(this.canvas.width / LOGICAL_W, this.canvas.height / LOGICAL_H);
    this.scale = s;
    this.offsetX = (this.canvas.width - LOGICAL_W * s) / 2;
    this.offsetY = (this.canvas.height - LOGICAL_H * s) / 2;
  }

  /** 画面上のクリック位置を論理座標に変換する */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / Math.max(1, rect.width);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  hitSlot(clientX: number, clientY: number): SlotId | null {
    const { x, y } = this.toLogical(clientX, clientY);
    return slotAt(x, y);
  }

  markBuilt(slot: SlotId, now = performance.now()): void {
    this.popAnim.set(slot, { start: now, kind: 'build' });
    const p = slotPositions().find((s) => s.slot === slot);
    if (p) this.effects.burstDust(p.x, p.y, now);
  }

  markUpgraded(slot: SlotId, now = performance.now()): void {
    this.popAnim.set(slot, { start: now, kind: 'upgrade' });
    const p = slotPositions().find((s) => s.slot === slot);
    if (p) this.effects.burstSparkle(p.x, p.y, now);
  }

  celebrateStars(amount: number, now = performance.now()): void {
    this.effects.rainStars(amount, now, LOGICAL_W);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.draw(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  draw(t: number): void {
    const ctx = this.ctx;
    const save = this.getSave();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    this.drawSky(ctx, t, save);
    this.drawIsland(ctx);
    this.drawTiles(ctx, save, t);
    this.drawDecor(ctx, save, t);
    this.effects.draw(ctx, t);
  }

  private drawSky(ctx: CanvasRenderingContext2D, t: number, save: SaveData): void {
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const clouds = [
      { x: (t / 90) % (LOGICAL_W + 60) - 30, y: 24, w: 22 },
      { x: (t / 140 + 120) % (LOGICAL_W + 60) - 30, y: 46, w: 16 },
    ];
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.w * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.5, c.y - 2, c.w * 0.6, c.w * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 街が育つと鳥が飛ぶ
    if (buildingCount(save) >= 3) {
      ctx.strokeStyle = 'rgba(90,100,110,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i += 1) {
        const bx = ((t / 50 + i * 70) % (LOGICAL_W + 40)) - 20;
        const by = 60 + Math.sin(t / 700 + i) * 6 + i * 10;
        ctx.beginPath();
        ctx.moveTo(bx - 3, by);
        ctx.lineTo(bx, by - 2);
        ctx.lineTo(bx + 3, by);
        ctx.stroke();
      }
    }
  }

  private drawIsland(ctx: CanvasRenderingContext2D): void {
    const cx = 90;
    const cy = 130;
    const hw = 72;
    const hh = 36;
    const depth = 12;

    // 土の側面
    ctx.fillStyle = PALETTE.soilDark;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw, cy + depth);
    ctx.lineTo(cx, cy + hh + depth);
    ctx.lineTo(cx - hw, cy + depth);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.soil;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + depth * 0.6);
    ctx.lineTo(cx - hw, cy + depth * 0.6);
    ctx.closePath();
    ctx.fill();

    // 芝生の面
    ctx.fillStyle = PALETTE.grass;
    diamond(ctx, cx, cy, hw, hh);
    ctx.fill();
    ctx.fillStyle = PALETTE.grassLight;
    diamond(ctx, cx - 10, cy - 6, hw * 0.55, hh * 0.55);
    ctx.fill();
  }

  private drawTiles(ctx: CanvasRenderingContext2D, save: SaveData, t: number): void {
    const positions = slotPositions().sort((a, b) => a.depth - b.depth || a.y - b.y);

    // 先に全区画の地面を描く
    for (const p of positions) {
      const b = save.buildings[p.slot];
      ctx.fillStyle = b ? PALETTE.grassDark : 'rgba(255,255,255,0.22)';
      diamond(ctx, p.x, p.y, TILE_W / 2 - 1.5, TILE_H / 2 - 1);
      ctx.fill();

      if (!b) {
        ctx.strokeStyle = this.selectedSlot === p.slot ? '#ffffff' : 'rgba(255,255,255,0.75)';
        ctx.lineWidth = this.selectedSlot === p.slot ? 1.6 : 1;
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -((t / 70) % 6);
        diamond(ctx, p.x, p.y, TILE_W / 2 - 2, TILE_H / 2 - 1.5);
        ctx.stroke();
        ctx.setLineDash([]);
        // 「ここに建てられる」記号
        const pulse = (Math.sin(t / 420) + 1) / 2;
        ctx.globalAlpha = 0.55 + pulse * 0.45;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 1), 7, 2);
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 3), 2, 7);
        ctx.globalAlpha = 1;
      } else if (this.selectedSlot === p.slot) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        diamond(ctx, p.x, p.y, TILE_W / 2 - 2, TILE_H / 2 - 1.5);
        ctx.stroke();
      }
    }

    // 奥から手前の順に建物を描く
    for (const p of positions) {
      const b = save.buildings[p.slot];
      if (!b) continue;
      const anim = this.popAnim.get(p.slot);
      let scale = 1;
      let lift = 0;
      if (anim) {
        const age = t - anim.start;
        const dur = anim.kind === 'build' ? 620 : 760;
        if (age > dur) {
          this.popAnim.delete(p.slot);
        } else {
          const k = age / dur;
          if (anim.kind === 'build') {
            // 下からせり上がる（少し行き過ぎて戻る）
            const e = 1 - Math.pow(1 - k, 3);
            scale = 0.2 + e * 0.9 - Math.sin(k * Math.PI) * 0.08;
          } else {
            scale = 1 + Math.sin(k * Math.PI) * 0.14;
            lift = -Math.sin(k * Math.PI) * 3;
          }
        }
      }
      ctx.save();
      ctx.translate(p.x, p.y + lift);
      ctx.scale(scale, scale);
      drawBuilding(ctx, b.type, 0, 0, b.level, t);
      ctx.restore();
    }
  }

  private drawDecor(ctx: CanvasRenderingContext2D, save: SaveData, t: number): void {
    const level = townLevel(save);
    if (level >= 6) {
      // 街灯
      const lamps = [
        { x: 36, y: 142 },
        { x: 146, y: 136 },
      ];
      for (const l of lamps) {
        ctx.fillStyle = '#7b6b58';
        ctx.fillRect(l.x, l.y - 12, 1, 12);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(l.x - 1, l.y - 15, 3, 3);
        const glow = (Math.sin(t / 700) + 1) / 2;
        ctx.globalAlpha = 0.18 + glow * 0.12;
        ctx.beginPath();
        ctx.arc(l.x, l.y - 14, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (level >= 10) {
      // にぎやかさの印として、島のふちに星が舞う
      for (let i = 0; i < 3; i += 1) {
        const a = t / 1600 + (i * Math.PI * 2) / 3;
        const x = 90 + Math.cos(a) * 74;
        const y = 128 + Math.sin(a) * 34;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 400 + i);
        drawPixelStar(ctx, x, y, 2, '#ffe079');
        ctx.globalAlpha = 1;
      }
    }
  }
}
