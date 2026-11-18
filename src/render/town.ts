/**
 * 街の描画。
 * 区画の座標を world 座標に置き、カメラ（拡大・縮小・スクロール）を通して描く。
 * 画面に映っている区画だけを描くので、街が大きくなっても重くなりにくい。
 */
import { TILE_PX } from '../core/config';
import { cellKey, parseCell } from '../core/grid';
import type { CellKey } from '../core/grid';
import { buildingCount } from '../core/buildings';
import { buyableCells } from '../core/land';
import type { SaveData } from '../core/types';
import { TILE_H, TILE_W, fitCamera, panBy, screenToWorld, tileWidthPx, visibleBounds, zoomAt } from './camera';
import type { Camera } from './camera';
import { EffectLayer } from './effects';
import { cellAt, cellPositions, landBounds } from './geometry';
import type { CellPos } from './geometry';
import { PALETTE, drawBuilding } from './sprites';

/** 星が降る演出などを描く、画面に固定された論理座標の横幅（今までの見た目に合わせる） */
export const LOGICAL_W = 180;

/** 区画の土の厚み（world px） */
const SOIL_DEPTH = 8;
/** 画面外判定の余白（建物の高さぶん） */
const CULL_MARGIN = 80;
/** 小さすぎる区画をタップしたとき、この横幅まで寄る */
const TAP_ZOOM_TARGET_PX = 72;

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function inBounds(p: CellPos, b: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export interface TownRendererOptions {
  /** false ならタイトル画面用：操作できず、常に街全体を映す */
  interactive?: boolean;
}

export class TownRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** 街の上の演出（土ぼこり・きらめき）。world 座標 */
  readonly effects = new EffectLayer();
  /** 画面に固定の演出（星が降る）。横幅 LOGICAL_W の論理座標 */
  private screenFx = new EffectLayer();
  private rafId = 0;
  private running = false;
  private dpr = 1;
  private viewW = 1;
  private viewH = 1;
  readonly interactive: boolean;
  camera: Camera = { cx: 0, cy: 0, zoom: 1 };
  /** 利用者がカメラを動かしたか（動かしていなければ画面サイズの変更で全体表示し直す） */
  private userMoved = false;
  selectedCell: CellKey | null = null;
  /** 建設・強化の直後に、その区画だけ一瞬大きくする */
  private popAnim = new Map<CellKey, { start: number; kind: 'build' | 'upgrade' }>();
  private getSave: () => SaveData;

  constructor(canvas: HTMLCanvasElement, getSave: () => SaveData, options: TownRendererOptions = {}) {
    this.canvas = canvas;
    this.getSave = getSave;
    this.interactive = options.interactive ?? true;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.viewW = Math.max(1, rect.width);
    this.viewH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    if (!this.interactive || !this.userMoved) this.fitToLand();
  }

  /** 持っている土地の全体が映る位置と倍率にする */
  fitToLand(): void {
    this.camera = fitCamera(landBounds(this.getSave().land), this.viewW, this.viewH);
    this.userMoved = false;
  }

  /** 利用者がカメラを動かしていなければ、街全体を映し直す（土地を買ったあとなど） */
  refitIfUntouched(): void {
    if (!this.userMoved) this.fitToLand();
  }

  // ---------------- 操作 ----------------

  private toScreen(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  pan(dxCss: number, dyCss: number): void {
    if (!this.interactive) return;
    this.camera = panBy(this.camera, dxCss, dyCss);
    this.userMoved = true;
  }

  zoomAtClient(clientX: number, clientY: number, factor: number): void {
    if (!this.interactive) return;
    const s = this.toScreen(clientX, clientY);
    this.camera = zoomAt(this.camera, this.viewW, this.viewH, s.x, s.y, factor);
    this.userMoved = true;
  }

  /** 区画が小さすぎてタップでは選ばせないか */
  isTapTooSmall(): boolean {
    return tileWidthPx(this.camera) < TILE_PX.tapMin;
  }

  /** 小さすぎる区画をタップしたとき、その場所に寄る */
  zoomToTap(clientX: number, clientY: number): void {
    this.zoomAtClient(clientX, clientY, TAP_ZOOM_TARGET_PX / tileWidthPx(this.camera));
  }

  /** タップした位置の区画（持っている土地と、買える土地） */
  hitCell(clientX: number, clientY: number): CellKey | null {
    const s = this.toScreen(clientX, clientY);
    const w = screenToWorld(this.camera, this.viewW, this.viewH, s.x, s.y);
    const save = this.getSave();
    return cellAt([...save.land, ...buyableCells(save)], w.x, w.y);
  }

  // ---------------- 演出 ----------------

  markBuilt(cell: CellKey, now = performance.now()): void {
    this.popAnim.set(cell, { start: now, kind: 'build' });
    const p = cellPositions([cell])[0];
    if (p) this.effects.burstDust(p.x, p.y, now);
  }

  markUpgraded(cell: CellKey, now = performance.now()): void {
    this.popAnim.set(cell, { start: now, kind: 'upgrade' });
    const p = cellPositions([cell])[0];
    if (p) this.effects.burstSparkle(p.x, p.y, now);
  }

  /** 土地を買ったとき */
  markLand(cell: CellKey, now = performance.now()): void {
    const p = cellPositions([cell])[0];
    if (p) this.effects.burstDust(p.x, p.y, now);
  }

  celebrateStars(amount: number, now = performance.now()): void {
    this.screenFx.rainStars(amount, now, LOGICAL_W);
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

  // ---------------- 描画 ----------------

  draw(t: number): void {
    const ctx = this.ctx;
    const save = this.getSave();
    if (!this.interactive) this.fitToLand();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;

    // 空（画面に固定）
    const k = (this.viewW / LOGICAL_W) * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.drawSky(ctx, t, save, this.viewH / (this.viewW / LOGICAL_W));

    // 街（カメラを通す）
    const cam = this.camera;
    const z = cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, (this.viewW / 2 - cam.cx * cam.zoom) * this.dpr, (this.viewH / 2 - cam.cy * cam.zoom) * this.dpr);
    const view = visibleBounds(cam, this.viewW, this.viewH, CULL_MARGIN);
    const owned = cellPositions(save.land).filter((p) => inBounds(p, view));
    owned.sort((a, b) => a.depth - b.depth || a.x - b.x);
    const forSale = this.interactive ? cellPositions(buyableCells(save)).filter((p) => inBounds(p, view)) : [];

    this.drawGround(ctx, save, owned);
    this.drawForSale(ctx, forSale, t);
    this.drawTiles(ctx, save, owned, t);
    this.effects.draw(ctx, t);

    // 画面に固定の演出
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.screenFx.draw(ctx, t);
  }

  private drawSky(ctx: CanvasRenderingContext2D, t: number, save: SaveData, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, h);

    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const clouds = [
      { x: ((t / 90) % (LOGICAL_W + 60)) - 30, y: 24, w: 22 },
      { x: ((t / 140 + 120) % (LOGICAL_W + 60)) - 30, y: 46, w: 16 },
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

  /** 持っている土地の地面。手前のふちには土の側面を描いて、島のように見せる */
  private drawGround(ctx: CanvasRenderingContext2D, save: SaveData, owned: CellPos[]): void {
    const land = new Set(save.land);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    for (const p of owned) {
      const c = parseCell(p.cell)!;
      // 右手前（x+1）と左手前（y+1）に土地がなければ、側面が見える
      if (!land.has(cellKey(c.x + 1, c.y))) {
        ctx.fillStyle = PALETTE.soilDark;
        ctx.beginPath();
        ctx.moveTo(p.x + hw, p.y);
        ctx.lineTo(p.x, p.y + hh);
        ctx.lineTo(p.x, p.y + hh + SOIL_DEPTH);
        ctx.lineTo(p.x + hw, p.y + SOIL_DEPTH);
        ctx.closePath();
        ctx.fill();
      }
      if (!land.has(cellKey(c.x, c.y + 1))) {
        ctx.fillStyle = PALETTE.soil;
        ctx.beginPath();
        ctx.moveTo(p.x - hw, p.y);
        ctx.lineTo(p.x, p.y + hh);
        ctx.lineTo(p.x, p.y + hh + SOIL_DEPTH);
        ctx.lineTo(p.x - hw, p.y + SOIL_DEPTH);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const p of owned) {
      ctx.fillStyle = PALETTE.grass;
      diamond(ctx, p.x, p.y, hw + 0.5, hh + 0.25);
      ctx.fill();
      ctx.fillStyle = PALETTE.grassLight;
      diamond(ctx, p.x - 3, p.y - 2, hw * 0.45, hh * 0.45);
      ctx.fill();
    }
  }

  /** 買える土地：薄いひし形と「売地」の小さな立て札 */
  private drawForSale(ctx: CanvasRenderingContext2D, cells: CellPos[], t: number): void {
    for (const p of cells) {
      const selected = this.selectedCell === p.cell;
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
      diamond(ctx, p.x, p.y, TILE_W / 2 - 2, TILE_H / 2 - 1);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = selected ? 1.4 : 0.8;
      ctx.setLineDash([2, 3]);
      ctx.lineDashOffset = -((t / 90) % 5);
      diamond(ctx, p.x, p.y, TILE_W / 2 - 2.5, TILE_H / 2 - 1.5);
      ctx.stroke();
      ctx.setLineDash([]);
      // 立て札
      ctx.fillStyle = '#9c7149';
      ctx.fillRect(Math.round(p.x), Math.round(p.y - 9), 1, 9);
      ctx.fillStyle = '#fff6ea';
      ctx.fillRect(Math.round(p.x - 4), Math.round(p.y - 12), 9, 5);
      ctx.fillStyle = '#c45a4b';
      ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 11), 7, 1);
      ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 9), 5, 1);
    }
  }

  private drawTiles(ctx: CanvasRenderingContext2D, save: SaveData, owned: CellPos[], t: number): void {
    // 先に区画の地面の印を描く
    for (const p of owned) {
      const b = save.buildings[p.cell];
      ctx.fillStyle = b ? PALETTE.grassDark : 'rgba(255,255,255,0.22)';
      diamond(ctx, p.x, p.y, TILE_W / 2 - 1.5, TILE_H / 2 - 1);
      ctx.fill();

      if (!b) {
        ctx.strokeStyle = this.selectedCell === p.cell ? '#ffffff' : 'rgba(255,255,255,0.75)';
        ctx.lineWidth = this.selectedCell === p.cell ? 1.6 : 1;
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
      } else if (this.selectedCell === p.cell) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        diamond(ctx, p.x, p.y, TILE_W / 2 - 2, TILE_H / 2 - 1.5);
        ctx.stroke();
      }
    }

    // 奥から手前の順に建物を描く
    for (const p of owned) {
      const b = save.buildings[p.cell];
      if (!b) continue;
      const anim = this.popAnim.get(p.cell);
      let scale = 1;
      let lift = 0;
      if (anim) {
        const age = t - anim.start;
        const dur = anim.kind === 'build' ? 620 : 760;
        if (age > dur) {
          this.popAnim.delete(p.cell);
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
}

export { TILE_H, TILE_W };
