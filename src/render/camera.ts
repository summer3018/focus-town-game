/**
 * 街を映すカメラの計算（純粋関数・DOM なし）。
 * 座標は2種類：
 *  - world：街の論理座標（区画のひし形の横幅が TILE_W）
 *  - screen：キャンバス左上を原点にした CSS px
 */
import { TILE_PX } from '../core/config';

/** 区画のひし形の論理サイズ（横:縦 = 2:1） */
export const TILE_W = 48;
export const TILE_H = 24;

export interface Camera {
  /** 画面の中心に映す world 座標 */
  cx: number;
  cy: number;
  /** CSS px / world px */
  zoom: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function tileWidthPx(cam: Camera): number {
  return TILE_W * cam.zoom;
}

export function clampZoom(zoom: number): number {
  const min = TILE_PX.min / TILE_W;
  const max = TILE_PX.max / TILE_W;
  return Math.min(max, Math.max(min, zoom));
}

/**
 * 外枠が画面に収まる倍率と位置。ただし区画は minTilePx（既定は TILE_PX.tapMin）より小さくしない。
 * タイトル画面のように操作しない表示では minTilePx = 0 にして、必ず全体を収める。
 */
export function fitCamera(bounds: Bounds, viewW: number, viewH: number, minTilePx: number = TILE_PX.tapMin): Camera {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const fit = Math.min(viewW / bw, viewH / bh);
  const zoom = Math.min(TILE_PX.max / TILE_W, Math.max(minTilePx / TILE_W, fit));
  return { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2, zoom };
}

export function screenToWorld(cam: Camera, viewW: number, viewH: number, sx: number, sy: number): { x: number; y: number } {
  return { x: cam.cx + (sx - viewW / 2) / cam.zoom, y: cam.cy + (sy - viewH / 2) / cam.zoom };
}

export function worldToScreen(cam: Camera, viewW: number, viewH: number, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - cam.cx) * cam.zoom + viewW / 2, y: (wy - cam.cy) * cam.zoom + viewH / 2 };
}

/** 画面上の (sx, sy) の下にある点を動かさずに拡大・縮小する */
export function zoomAt(cam: Camera, viewW: number, viewH: number, sx: number, sy: number, factor: number): Camera {
  const zoom = clampZoom(cam.zoom * factor);
  const w = screenToWorld(cam, viewW, viewH, sx, sy);
  return { cx: w.x - (sx - viewW / 2) / zoom, cy: w.y - (sy - viewH / 2) / zoom, zoom };
}

/** 指を (dx, dy) CSS px 動かしたぶん、街を同じ向きに動かす */
export function panBy(cam: Camera, dxCss: number, dyCss: number): Camera {
  return { cx: cam.cx - dxCss / cam.zoom, cy: cam.cy - dyCss / cam.zoom, zoom: cam.zoom };
}

/** 画面に映る world の範囲（margin は world px） */
export function visibleBounds(cam: Camera, viewW: number, viewH: number, margin: number): Bounds {
  const hw = viewW / 2 / cam.zoom;
  const hh = viewH / 2 / cam.zoom;
  return { minX: cam.cx - hw - margin, maxX: cam.cx + hw + margin, minY: cam.cy - hh - margin, maxY: cam.cy + hh + margin };
}
