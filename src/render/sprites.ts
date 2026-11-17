/**
 * 建物のドット絵。すべて矩形と多角形で描く（外部素材を使わない）。
 * 座標は「区画の中心＝地面の接地点」を原点にした相対位置で考える。
 */
import type { BuildingType } from '../core/types';
import { drawCityBuilding } from './sprites-city';
import { flower, person, rect, roof, shadow, smoke, tree } from './sprite-kit';

export const PALETTE = {
  skyTop: '#d9ecf5',
  skyBottom: '#f3e7d4',
  grass: '#8fcb7c',
  grassDark: '#74b566',
  grassLight: '#a4d88d',
  soil: '#b98f63',
  soilDark: '#966e4a',
  shadow: 'rgba(60, 70, 60, 0.18)',
  outline: '#4a5a4a',
};

// ---------------- 家 ----------------

function drawHouse(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const wall = '#f6e6cd';
  const wallShade = '#e2cbab';
  const roofColor = '#cc7257';
  const roofEdge = '#a9533d';
  const win = '#89c8e3';

  if (level === 1) {
    shadow(ctx, cx, cy, 10);
    rect(ctx, cx - 7, cy - 11, 14, 11, wall);
    rect(ctx, cx + 3, cy - 11, 4, 11, wallShade);
    roof(ctx, cx, cy - 19, 10, 8, roofColor, roofEdge);
    rect(ctx, cx - 4, cy - 8, 4, 4, win);
    rect(ctx, cx + 1, cy - 6, 3, 6, '#9a6a46');
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 12);
    rect(ctx, cx - 9, cy - 13, 18, 13, wall);
    rect(ctx, cx + 4, cy - 13, 5, 13, wallShade);
    roof(ctx, cx, cy - 23, 12, 10, roofColor, roofEdge);
    rect(ctx, cx + 4, cy - 26, 3, 6, '#9c5f49'); // 煙突
    smoke(ctx, cx + 5, cy - 28, t);
    rect(ctx, cx - 6, cy - 10, 4, 4, win);
    rect(ctx, cx - 1, cy - 10, 4, 4, win);
    rect(ctx, cx + 4, cy - 6, 3, 6, '#9a6a46');
    return;
  }

  // level 3: 二階建て・柵・住人
  shadow(ctx, cx, cy, 14);
  rect(ctx, cx - 11, cy - 22, 22, 22, wall);
  rect(ctx, cx + 5, cy - 22, 6, 22, wallShade);
  rect(ctx, cx - 11, cy - 12, 22, 1, '#d8bb97');
  roof(ctx, cx, cy - 32, 14, 10, roofColor, roofEdge);
  rect(ctx, cx + 6, cy - 35, 3, 7, '#9c5f49');
  smoke(ctx, cx + 7, cy - 37, t);
  rect(ctx, cx - 8, cy - 20, 4, 4, win);
  rect(ctx, cx - 2, cy - 20, 4, 4, win);
  rect(ctx, cx + 4, cy - 20, 4, 4, win);
  rect(ctx, cx - 8, cy - 9, 4, 4, win);
  rect(ctx, cx + 3, cy - 7, 4, 7, '#9a6a46');
  // 柵
  for (let i = -14; i <= 14; i += 4) {
    rect(ctx, cx + i, cy - 4, 1, 4, '#e7d6bc');
  }
  rect(ctx, cx - 14, cy - 3, 29, 1, '#e7d6bc');
  person(ctx, cx - 16, cy, t, '#5a86b8', 0);
  person(ctx, cx + 15, cy, t, '#c2697f', 1.6);
}

// ---------------- お店 ----------------

function drawShop(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const wall = '#fff3e0';
  const wallShade = '#ead9c2';
  const stripeA = '#e2705f';
  const stripeB = '#fff6ea';

  const awning = (x: number, y: number, w: number, stripes: number) => {
    const sw = w / stripes;
    for (let i = 0; i < stripes; i += 1) {
      rect(ctx, x + i * sw, y, sw, 4, i % 2 === 0 ? stripeA : stripeB);
    }
    rect(ctx, x, y + 4, w, 1, '#c45a4b');
  };

  if (level === 1) {
    shadow(ctx, cx, cy, 10);
    rect(ctx, cx - 8, cy - 10, 16, 10, wall);
    rect(ctx, cx + 4, cy - 10, 4, 10, wallShade);
    awning(cx - 10, cy - 14, 20, 5);
    rect(ctx, cx - 5, cy - 7, 10, 3, '#cfae89');
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 12);
    rect(ctx, cx - 10, cy - 14, 20, 14, wall);
    rect(ctx, cx + 5, cy - 14, 5, 14, wallShade);
    rect(ctx, cx - 10, cy - 20, 20, 5, '#8a6342'); // 看板
    rect(ctx, cx - 7, cy - 18, 14, 1, '#ffe9c4');
    awning(cx - 12, cy - 15, 24, 6);
    rect(ctx, cx - 7, cy - 9, 7, 5, '#a8d6e8'); // 窓
    rect(ctx, cx + 2, cy - 8, 5, 8, '#9a6a46'); // 扉
    return;
  }

  // level 3: 大きな看板・旗・お客さん
  shadow(ctx, cx, cy, 15);
  rect(ctx, cx - 13, cy - 18, 26, 18, wall);
  rect(ctx, cx + 7, cy - 18, 6, 18, wallShade);
  rect(ctx, cx - 13, cy - 26, 26, 7, '#8a6342');
  rect(ctx, cx - 10, cy - 24, 20, 1, '#ffe9c4');
  rect(ctx, cx - 10, cy - 22, 13, 1, '#ffe9c4');
  // 看板のきらめき
  const blink = (Math.sin(t / 380) + 1) / 2;
  ctx.globalAlpha = 0.4 + blink * 0.6;
  rect(ctx, cx + 8, cy - 25, 2, 2, '#ffe06a');
  ctx.globalAlpha = 1;
  awning(cx - 15, cy - 19, 30, 7);
  // 旗
  const wave = Math.sin(t / 260) * 2;
  rect(ctx, cx - 15, cy - 33, 1, 8, '#8a6342');
  ctx.fillStyle = '#e2705f';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 33);
  ctx.lineTo(cx - 8 + wave, cy - 31);
  ctx.lineTo(cx - 14, cy - 28);
  ctx.closePath();
  ctx.fill();
  rect(ctx, cx - 10, cy - 12, 8, 6, '#a8d6e8');
  rect(ctx, cx + 1, cy - 11, 6, 11, '#9a6a46');
  person(ctx, cx + 12, cy, t, '#6aa98a', 0.8);
  person(ctx, cx - 18, cy, t, '#b58a52', 2.2);
}

// ---------------- 公園 ----------------

function drawPark(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  // 芝生の下地
  ctx.fillStyle = '#9bd68a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, level === 1 ? 13 : level === 2 ? 16 : 19, (level === 1 ? 13 : level === 2 ? 16 : 19) * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (level === 1) {
    tree(ctx, cx - 1, cy, 16, t, 0);
    rect(ctx, cx + 6, cy - 2, 3, 2, '#79c06c');
    return;
  }

  if (level === 2) {
    tree(ctx, cx - 7, cy + 1, 15, t, 0);
    tree(ctx, cx + 4, cy - 1, 18, t, 1.4);
    flower(ctx, cx - 1, cy + 3, '#ef7f9a');
    flower(ctx, cx + 10, cy + 2, '#f7d26a');
    flower(ctx, cx - 11, cy + 3, '#f0f0f0');
    // ベンチ
    rect(ctx, cx - 4, cy - 3, 7, 1, '#9c7149');
    rect(ctx, cx - 4, cy - 2, 1, 2, '#7f5a38');
    rect(ctx, cx + 2, cy - 2, 1, 2, '#7f5a38');
    return;
  }

  // level 3: 池つき
  ctx.fillStyle = '#6fc0d8';
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 2, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const shimmer = Math.sin(t / 500);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(Math.round(cx + 2 + shimmer * 2), Math.round(cy + 1), 4, 1);
  ctx.fillRect(Math.round(cx + 6 - shimmer * 2), Math.round(cy + 3), 3, 1);

  tree(ctx, cx - 11, cy + 1, 16, t, 0);
  tree(ctx, cx - 3, cy - 2, 20, t, 1.1);
  tree(ctx, cx + 11, cy - 1, 15, t, 2.3);
  flower(ctx, cx - 7, cy + 4, '#ef7f9a');
  flower(ctx, cx - 14, cy + 2, '#f7d26a');
  flower(ctx, cx + 1, cy + 5, '#f0f0f0');
  flower(ctx, cx + 15, cy + 3, '#ef7f9a');
  rect(ctx, cx - 9, cy - 4, 8, 1, '#9c7149');
  rect(ctx, cx - 9, cy - 3, 1, 3, '#7f5a38');
  rect(ctx, cx - 2, cy - 3, 1, 3, '#7f5a38');
  person(ctx, cx + 16, cy + 1, t, '#8a7fc2', 0.4);
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  type: BuildingType,
  cx: number,
  cy: number,
  level: number,
  t: number,
): void {
  const lv = Math.min(3, Math.max(1, level));
  if (type === 'house') drawHouse(ctx, cx, cy, lv, t);
  else if (type === 'shop') drawShop(ctx, cx, cy, lv, t);
  else if (type === 'park') drawPark(ctx, cx, cy, lv, t);
  else drawCityBuilding(ctx, type, cx, cy, lv, t);
}

/** 建物選択メニューのアイコン用に、小さく1体だけ描く */
export function drawBuildingPreview(
  ctx: CanvasRenderingContext2D,
  type: BuildingType,
  level: number,
  width: number,
  height: number,
  t: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height - 6);
  drawBuilding(ctx, type, 0, 0, level, t);
  ctx.restore();
}
