import { describe, expect, it } from 'vitest';
import { TILE_PX } from '../src/core/config';
import {
  TILE_W,
  clampZoom,
  fitCamera,
  panBy,
  screenToWorld,
  tileWidthPx,
  visibleBounds,
  worldToScreen,
  zoomAt,
} from '../src/render/camera';
import type { Camera } from '../src/render/camera';

const VW = 390;
const VH = 500;

describe('カメラ', () => {
  it('区画の横幅が 32〜160px に収まるよう倍率を制限する', () => {
    expect(TILE_PX).toEqual({ min: 32, max: 160, tapMin: 56 });
    expect(clampZoom(0.01) * TILE_W).toBeCloseTo(32);
    expect(clampZoom(100) * TILE_W).toBeCloseTo(160);
    expect(clampZoom(2)).toBe(2);
  });

  it('小さな街は全体が画面に収まる', () => {
    const b = { minX: 0, minY: 0, maxX: 120, maxY: 80 };
    const cam = fitCamera(b, VW, VH);
    const tl = worldToScreen(cam, VW, VH, b.minX, b.minY);
    const br = worldToScreen(cam, VW, VH, b.maxX, b.maxY);
    expect(tl.x).toBeGreaterThanOrEqual(-1e-6);
    expect(tl.y).toBeGreaterThanOrEqual(-1e-6);
    expect(br.x).toBeLessThanOrEqual(VW + 1e-6);
    expect(br.y).toBeLessThanOrEqual(VH + 1e-6);
  });

  it('大きな街は区画 56px を保ち、外枠の中心を映す', () => {
    const b = { minX: -4800, minY: -2400, maxX: 4800, maxY: 2400 };
    const cam = fitCamera(b, VW, VH);
    expect(tileWidthPx(cam)).toBeCloseTo(56);
    expect(cam.cx).toBeCloseTo(0);
    expect(cam.cy).toBeCloseTo(0);
  });

  it('screenToWorld と worldToScreen は逆の変換', () => {
    const cam: Camera = { cx: 30, cy: -12, zoom: 1.7 };
    const p = { x: 55.5, y: 101.25 };
    const s = worldToScreen(cam, VW, VH, p.x, p.y);
    const back = screenToWorld(cam, VW, VH, s.x, s.y);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
  });

  it('zoomAt は指の下の点を動かさない', () => {
    const cam: Camera = { cx: 10, cy: 20, zoom: 1.5 };
    const before = screenToWorld(cam, VW, VH, 300, 120);
    const next = zoomAt(cam, VW, VH, 300, 120, 1.6);
    const after = screenToWorld(next, VW, VH, 300, 120);
    expect(next.zoom).toBeCloseTo(2.4);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('zoomAt も倍率の制限を守る', () => {
    const cam: Camera = { cx: 0, cy: 0, zoom: 3 };
    expect(tileWidthPx(zoomAt(cam, VW, VH, 0, 0, 10))).toBeCloseTo(160);
  });

  it('panBy は指を動かした方向に街が動く', () => {
    const cam: Camera = { cx: 0, cy: 0, zoom: 2 };
    const next = panBy(cam, 20, -10);
    const before = worldToScreen(cam, VW, VH, 5, 5);
    const after = worldToScreen(next, VW, VH, 5, 5);
    expect(after.x - before.x).toBeCloseTo(20);
    expect(after.y - before.y).toBeCloseTo(-10);
  });

  it('visibleBounds は画面に映る範囲（余白つき）', () => {
    const cam: Camera = { cx: 100, cy: 50, zoom: 2 };
    const v = visibleBounds(cam, VW, VH, 10);
    expect(v.minX).toBeCloseTo(100 - VW / 4 - 10);
    expect(v.maxX).toBeCloseTo(100 + VW / 4 + 10);
    expect(v.minY).toBeCloseTo(50 - VH / 4 - 10);
    expect(v.maxY).toBeCloseTo(50 + VH / 4 + 10);
  });
});
