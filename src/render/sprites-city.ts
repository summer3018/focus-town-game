/**
 * 街が育つと解放される建物のドット絵（田舎 → 都会）。
 * 座標は「区画の中心＝地面の接地点」を原点にした相対位置。横幅は ±26 以内に収める。
 */
import type { BuildingType } from '../core/types';
import { flower, person, rect, roof, shadow, smoke, tree } from './sprite-kit';

type CityType = Exclude<BuildingType, 'house' | 'shop' | 'park'>;

function blink(t: number, speed: number, offset = 0): number {
  return (Math.sin(t / speed + offset) + 1) / 2;
}

/** 地面に置く平たいひし形 */
function plot(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
}

// ---------------- 田んぼ・畑 ----------------

function drawField(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  if (level === 1) {
    plot(ctx, cx, cy, 18, 9, '#a97c52');
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        const x = cx + (c - r) * 4;
        const y = cy + (c + r) * 1.6;
        rect(ctx, x, y - 2, 1, 2, '#6fb85e');
        rect(ctx, x - 1, y - 3, 3, 1, '#8fd27a');
      }
    }
    return;
  }

  if (level === 2) {
    plot(ctx, cx, cy, 20, 10, '#8a6a45');
    plot(ctx, cx, cy, 17, 8.5, '#7fc4c9');
    const shimmer = Math.sin(t / 600) * 2;
    rect(ctx, cx - 6 + shimmer, cy - 1, 5, 1, 'rgba(255,255,255,0.7)');
    for (let i = -12; i <= 12; i += 4) rect(ctx, cx + i, cy + (i % 8 === 0 ? 1 : -1) - 2, 1, 2, '#5fae58');
    // かかし
    rect(ctx, cx + 9, cy - 13, 1, 11, '#7f5a38');
    rect(ctx, cx + 6, cy - 10, 7, 1, '#7f5a38');
    rect(ctx, cx + 8, cy - 16, 3, 3, '#f0d9a8');
    rect(ctx, cx + 7, cy - 17, 5, 1, '#c9a45a');
    return;
  }

  // level 3: 実りの田んぼ・小屋・稲架
  plot(ctx, cx, cy, 22, 11, '#8a6a45');
  plot(ctx, cx, cy, 19, 9.5, '#e4c25a');
  const sway = Math.sin(t / 700);
  for (let i = -15; i <= 9; i += 3) {
    rect(ctx, cx + i + (sway > 0 ? 1 : 0), cy - 3 + Math.abs(i % 6) / 2, 1, 3, '#c99a35');
  }
  // 小屋
  shadow(ctx, cx + 14, cy - 2, 6);
  rect(ctx, cx + 10, cy - 10, 9, 8, '#b98a5c');
  roof(ctx, cx + 14.5, cy - 15, 6, 5, '#7d6a5a', '#5e4f42');
  rect(ctx, cx + 13, cy - 6, 3, 4, '#6b4a2e');
  // 稲架
  rect(ctx, cx - 18, cy - 10, 1, 9, '#7f5a38');
  rect(ctx, cx - 6, cy - 10, 1, 9, '#7f5a38');
  rect(ctx, cx - 18, cy - 10, 13, 1, '#7f5a38');
  for (let i = -17; i <= -7; i += 2) rect(ctx, cx + i, cy - 9, 2, 4, '#d7b04a');
  person(ctx, cx - 1, cy + 3, t, '#6b8fb8', 0.5);
}

// ---------------- 郵便局 ----------------

function postBox(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x, y - 7, 3, 7, '#d9433b');
  rect(ctx, x, y - 8, 3, 1, '#a83029');
  rect(ctx, x + 1, y - 5, 1, 1, '#2f2f2f');
}

function drawPostOffice(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const wall = '#fbf3e8';
  const shade = '#e7d8c4';
  const red = '#d9534f';

  if (level === 1) {
    shadow(ctx, cx, cy, 11);
    rect(ctx, cx - 8, cy - 11, 16, 11, wall);
    rect(ctx, cx + 4, cy - 11, 4, 11, shade);
    rect(ctx, cx - 9, cy - 13, 18, 2, red);
    rect(ctx, cx - 2, cy - 7, 4, 7, '#8a6a4a');
    postBox(ctx, cx - 13, cy);
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 13);
    rect(ctx, cx - 10, cy - 14, 20, 14, wall);
    rect(ctx, cx + 5, cy - 14, 5, 14, shade);
    rect(ctx, cx - 11, cy - 17, 22, 3, red);
    rect(ctx, cx - 5, cy - 21, 10, 4, '#ffffff'); // 看板
    rect(ctx, cx - 3, cy - 20, 6, 1, red);
    rect(ctx, cx - 1, cy - 20, 1, 2, red);
    rect(ctx, cx - 8, cy - 10, 5, 4, '#a8d6e8');
    rect(ctx, cx - 1, cy - 8, 5, 8, '#8a6a4a');
    postBox(ctx, cx - 15, cy);
    // 自転車
    rect(ctx, cx + 12, cy - 2, 2, 2, '#3e4a5a');
    rect(ctx, cx + 17, cy - 2, 2, 2, '#3e4a5a');
    rect(ctx, cx + 13, cy - 3, 5, 1, '#5a7fb0');
    return;
  }

  // level 3: 二階建て・配達のバイク
  shadow(ctx, cx, cy, 15);
  rect(ctx, cx - 12, cy - 24, 24, 24, wall);
  rect(ctx, cx + 6, cy - 24, 6, 24, shade);
  rect(ctx, cx - 13, cy - 27, 26, 3, red);
  rect(ctx, cx - 12, cy - 13, 24, 2, red);
  for (const x of [-9, -3, 3]) rect(ctx, cx + x, cy - 21, 4, 4, '#a8d6e8');
  rect(ctx, cx - 9, cy - 9, 6, 4, '#a8d6e8');
  rect(ctx, cx + 1, cy - 9, 5, 9, '#8a6a4a');
  postBox(ctx, cx - 17, cy);
  const ride = ((t / 40) % 14) - 7;
  rect(ctx, cx + 14 + ride * 0.3, cy - 4, 6, 3, red);
  rect(ctx, cx + 14 + ride * 0.3, cy - 1, 2, 2, '#3e4a5a');
  rect(ctx, cx + 19 + ride * 0.3, cy - 1, 2, 2, '#3e4a5a');
  person(ctx, cx + 16 + ride * 0.3, cy - 3, t, '#4a6a3a', 0.2);
}

// ---------------- 学校 ----------------

function drawSchool(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const wood = '#d6a86a';
  const woodShade = '#b98a52';
  const win = '#bfe2ee';

  if (level === 1) {
    shadow(ctx, cx, cy, 13);
    rect(ctx, cx - 12, cy - 10, 24, 10, wood);
    rect(ctx, cx + 7, cy - 10, 5, 10, woodShade);
    roof(ctx, cx, cy - 16, 14, 6, '#5f6f86', '#46536a');
    for (const x of [-10, -5, 0]) rect(ctx, cx + x, cy - 8, 3, 3, win);
    rect(ctx, cx + 4, cy - 6, 3, 6, '#7a5636');
    return;
  }

  if (level === 2) {
    // 校庭
    plot(ctx, cx + 4, cy + 3, 16, 6, '#d9c28f');
    shadow(ctx, cx - 4, cy, 12);
    rect(ctx, cx - 16, cy - 12, 22, 12, wood);
    rect(ctx, cx + 1, cy - 12, 5, 12, woodShade);
    roof(ctx, cx - 5, cy - 18, 13, 6, '#5f6f86', '#46536a');
    for (const x of [-14, -9, -4]) rect(ctx, cx + x, cy - 9, 3, 4, win);
    // 鉄棒
    rect(ctx, cx + 10, cy - 5, 1, 6, '#7d8794');
    rect(ctx, cx + 17, cy - 5, 1, 6, '#7d8794');
    rect(ctx, cx + 10, cy - 5, 8, 1, '#a9b3bf');
    person(ctx, cx + 13, cy + 3, t, '#e07a5f', 0.7);
    return;
  }

  // level 3: 時計つきの大きな校舎
  plot(ctx, cx + 2, cy + 4, 20, 7, '#d9c28f');
  shadow(ctx, cx, cy, 16);
  rect(ctx, cx - 18, cy - 18, 36, 18, '#f1ece2');
  rect(ctx, cx + 12, cy - 18, 6, 18, '#ddd5c6');
  rect(ctx, cx - 18, cy - 10, 36, 1, '#cfc6b5');
  rect(ctx, cx - 4, cy - 26, 8, 8, '#f1ece2'); // 時計塔
  roof(ctx, cx, cy - 31, 6, 5, '#5f6f86', '#46536a');
  rect(ctx, cx - 2, cy - 24, 4, 4, '#ffffff');
  const hand = Math.floor(t / 1000) % 4;
  rect(ctx, cx, cy - 23, 1, 2, '#2f2f2f');
  rect(ctx, cx, cy - 22, hand % 2 === 0 ? 2 : 1, 1, '#2f2f2f');
  for (const x of [-16, -11, -6, 5, 10]) {
    rect(ctx, cx + x, cy - 16, 3, 4, win);
    rect(ctx, cx + x, cy - 8, 3, 4, win);
  }
  rect(ctx, cx - 2, cy - 7, 4, 7, '#7a5636');
  tree(ctx, cx - 22, cy + 2, 12, t, 0.3);
  person(ctx, cx + 8, cy + 5, t, '#e07a5f', 0.7);
  person(ctx, cx + 14, cy + 4, t, '#5a86b8', 1.9);
}

// ---------------- 駅 ----------------

function rails(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number): void {
  rect(ctx, cx - half, cy + 2, half * 2, 1, '#6a6a6a');
  rect(ctx, cx - half, cy + 5, half * 2, 1, '#6a6a6a');
  for (let i = -half; i < half; i += 3) rect(ctx, cx + i, cy + 2, 1, 4, '#8a6a4a');
}

function drawStation(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  if (level === 1) {
    rails(ctx, cx, cy, 20);
    rect(ctx, cx - 14, cy - 2, 28, 3, '#bfb6a5'); // ホーム
    rect(ctx, cx - 6, cy - 10, 1, 8, '#7d8794');
    rect(ctx, cx + 5, cy - 10, 1, 8, '#7d8794');
    rect(ctx, cx - 8, cy - 12, 16, 2, '#6b8fb8');
    rect(ctx, cx - 3, cy - 6, 6, 2, '#9c7149'); // ベンチ
    return;
  }

  if (level === 2) {
    rails(ctx, cx, cy, 22);
    rect(ctx, cx - 18, cy - 2, 36, 3, '#bfb6a5');
    shadow(ctx, cx - 6, cy - 3, 9);
    rect(ctx, cx - 14, cy - 13, 15, 11, '#f3ead9');
    rect(ctx, cx - 4, cy - 13, 5, 11, '#ddd2bd');
    roof(ctx, cx - 6.5, cy - 18, 10, 5, '#6b8fb8', '#4f6f96');
    rect(ctx, cx - 10, cy - 9, 4, 4, '#a8d6e8');
    // 電車（左右にゆっくり出入りする）
    const x = Math.round(((t / 60) % 40) - 20);
    if (Math.abs(x) < 14) {
      rect(ctx, cx + 4 + x * 0.2, cy - 8, 16, 7, '#e8eef3');
      rect(ctx, cx + 4 + x * 0.2, cy - 5, 16, 1, '#6b8fb8');
      rect(ctx, cx + 6 + x * 0.2, cy - 7, 3, 2, '#9fc6dc');
      rect(ctx, cx + 11 + x * 0.2, cy - 7, 3, 2, '#9fc6dc');
    }
    return;
  }

  // level 3: 屋根つきの大きな駅
  rails(ctx, cx, cy, 24);
  rect(ctx, cx - 22, cy - 2, 44, 3, '#c9c0ae');
  shadow(ctx, cx, cy - 3, 16);
  rect(ctx, cx - 16, cy - 16, 32, 14, '#f3ead9');
  rect(ctx, cx + 10, cy - 16, 6, 14, '#ddd2bd');
  ctx.fillStyle = '#4f6f96';
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 16);
  ctx.quadraticCurveTo(cx, cy - 30, cx + 20, cy - 16);
  ctx.closePath();
  ctx.fill();
  rect(ctx, cx - 5, cy - 22, 10, 3, '#ffffff');
  rect(ctx, cx - 3, cy - 21, 6, 1, '#4f6f96');
  for (const x of [-13, -7, 4, 9]) rect(ctx, cx + x, cy - 12, 4, 5, '#a8d6e8');
  rect(ctx, cx - 3, cy - 10, 6, 8, '#7a5636');
  const glow = blink(t, 600);
  ctx.globalAlpha = 0.5 + glow * 0.5;
  rect(ctx, cx - 1, cy - 26, 2, 2, '#ffe06a');
  ctx.globalAlpha = 1;
  person(ctx, cx - 18, cy - 1, t, '#c2697f', 0.3);
  person(ctx, cx + 18, cy - 1, t, '#6aa98a', 1.3);
  person(ctx, cx + 13, cy - 1, t, '#b58a52', 2.6);
}

// ---------------- 商店街 ----------------

function storefront(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  rect(ctx, x, y - h, w, h, color);
  rect(ctx, x + 1, y - h + 3, w - 2, 3, '#a8d6e8');
  rect(ctx, x + Math.floor(w / 2) - 1, y - 4, 3, 4, '#7a5636');
}

function drawShoppingStreet(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const arch = (y: number, w: number, color: string) => {
    rect(ctx, cx - w, y, 2, -y + cy, color);
    rect(ctx, cx + w - 2, y, 2, -y + cy, color);
    rect(ctx, cx - w, y - 3, w * 2, 3, color);
  };

  if (level === 1) {
    shadow(ctx, cx, cy, 14);
    storefront(ctx, cx - 16, cy, 10, 11, '#f6d8b8');
    storefront(ctx, cx + 6, cy, 10, 11, '#d8e6c4');
    arch(cy - 16, 8, '#c26a3c');
    rect(ctx, cx - 5, cy - 21, 10, 3, '#ffe9c4');
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 16);
    storefront(ctx, cx - 20, cy, 10, 13, '#f6d8b8');
    storefront(ctx, cx - 9, cy, 8, 11, '#f3c6c6');
    storefront(ctx, cx + 2, cy, 8, 11, '#c9dcef');
    storefront(ctx, cx + 11, cy, 9, 13, '#d8e6c4');
    arch(cy - 18, 10, '#c26a3c');
    rect(ctx, cx - 7, cy - 23, 14, 3, '#ffe9c4');
    // のぼり
    const wave = Math.sin(t / 300) > 0 ? 1 : 0;
    for (const x of [-22, 21]) {
      rect(ctx, cx + x, cy - 16, 1, 16, '#7f5a38');
      rect(ctx, cx + x + 1, cy - 15 + wave, 3, 8, x < 0 ? '#e2705f' : '#5fa86b');
    }
    return;
  }

  // level 3: 明かりのともるアーケード
  shadow(ctx, cx, cy, 18);
  storefront(ctx, cx - 22, cy, 10, 15, '#f6d8b8');
  storefront(ctx, cx - 11, cy, 10, 13, '#f3c6c6');
  storefront(ctx, cx + 1, cy, 10, 13, '#c9dcef');
  storefront(ctx, cx + 12, cy, 10, 15, '#d8e6c4');
  ctx.fillStyle = '#b8c9d6';
  ctx.beginPath();
  ctx.moveTo(cx - 23, cy - 16);
  ctx.quadraticCurveTo(cx, cy - 28, cx + 23, cy - 16);
  ctx.closePath();
  ctx.fill();
  rect(ctx, cx - 8, cy - 24, 16, 3, '#c26a3c');
  rect(ctx, cx - 6, cy - 23, 12, 1, '#ffe9c4');
  for (let i = 0; i < 6; i += 1) {
    ctx.globalAlpha = 0.45 + blink(t, 350, i) * 0.55;
    rect(ctx, cx - 18 + i * 7, cy - 18, 2, 2, '#ffd86a');
  }
  ctx.globalAlpha = 1;
  person(ctx, cx - 4, cy + 3, t, '#8a7fc2', 0.2);
  person(ctx, cx + 5, cy + 2, t, '#e07a5f', 1.5);
  flower(ctx, cx - 24, cy + 2, '#ef7f9a');
}

// ---------------- ビル ----------------

function windows(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, t: number, lit: number): void {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const on = (r * 7 + c * 3) % 10 < lit;
      const flicker = on && blink(t, 1300, r + c) > 0.15;
      rect(ctx, x + c * 4, y + r * 4, 2, 2, flicker ? '#ffe9a0' : '#9fb9cc');
    }
  }
}

function drawOffice(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  const face = '#c3cdd8';
  const side = '#a3afbd';

  if (level === 1) {
    shadow(ctx, cx, cy, 11);
    rect(ctx, cx - 8, cy - 22, 16, 22, face);
    rect(ctx, cx + 4, cy - 22, 4, 22, side);
    windows(ctx, cx - 6, cy - 20, 3, 4, t, 2);
    rect(ctx, cx - 2, cy - 4, 4, 4, '#5a6a7a');
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 13);
    rect(ctx, cx - 10, cy - 34, 20, 34, face);
    rect(ctx, cx + 5, cy - 34, 5, 34, side);
    windows(ctx, cx - 8, cy - 32, 4, 7, t, 5);
    rect(ctx, cx - 3, cy - 4, 6, 4, '#5a6a7a');
    rect(ctx, cx + 12, cy - 16, 7, 16, '#b4bfcc'); // となりの低い棟
    windows(ctx, cx + 13, cy - 14, 2, 3, t, 4);
    return;
  }

  // level 3: 屋上に看板のある高いビル
  shadow(ctx, cx, cy, 15);
  rect(ctx, cx - 12, cy - 48, 24, 48, '#b7c6d6');
  rect(ctx, cx + 6, cy - 48, 6, 48, '#93a4b8');
  windows(ctx, cx - 10, cy - 45, 5, 10, t, 7);
  rect(ctx, cx - 4, cy - 5, 8, 5, '#4a5a6a');
  rect(ctx, cx - 10, cy - 56, 20, 7, '#3e4a5a'); // 看板
  ctx.globalAlpha = 0.6 + blink(t, 500) * 0.4;
  rect(ctx, cx - 8, cy - 54, 16, 3, '#7fd3e8');
  ctx.globalAlpha = 1;
  rect(ctx, cx - 1, cy - 60, 1, 4, '#7d8794');
  ctx.globalAlpha = blink(t, 260) > 0.5 ? 1 : 0.3;
  rect(ctx, cx - 1, cy - 61, 2, 1, '#ff5a4a');
  ctx.globalAlpha = 1;
  person(ctx, cx - 16, cy + 1, t, '#3e4a5a', 0.6);
  person(ctx, cx + 16, cy + 1, t, '#c2697f', 2.0);
}

// ---------------- 電波塔 ----------------

function lattice(ctx: CanvasRenderingContext2D, cx: number, baseY: number, height: number, baseHalf: number, colors: string[]): void {
  const seg = 6;
  for (let i = 0; i < height; i += seg) {
    const k0 = i / height;
    const k1 = Math.min(1, (i + seg) / height);
    const w0 = baseHalf * (1 - k0 * 0.85);
    const w1 = baseHalf * (1 - k1 * 0.85);
    const y0 = baseY - i;
    const y1 = baseY - Math.min(height, i + seg);
    ctx.strokeStyle = colors[Math.floor(i / seg) % colors.length]!;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w0, y0);
    ctx.lineTo(cx - w1, y1);
    ctx.moveTo(cx + w0, y0);
    ctx.lineTo(cx + w1, y1);
    ctx.moveTo(cx - w0, y0);
    ctx.lineTo(cx + w1, y1);
    ctx.moveTo(cx + w0, y0);
    ctx.lineTo(cx - w1, y1);
    ctx.stroke();
    rect(ctx, cx - w1, y1, w1 * 2, 1, colors[Math.floor(i / seg) % colors.length]!);
  }
}

function drawRadioTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, t: number): void {
  if (level === 1) {
    shadow(ctx, cx, cy, 9);
    lattice(ctx, cx, cy, 30, 8, ['#8a8f96']);
    rect(ctx, cx - 1, cy - 34, 1, 4, '#8a8f96');
    return;
  }

  if (level === 2) {
    shadow(ctx, cx, cy, 11);
    lattice(ctx, cx, cy, 44, 10, ['#e06c5a', '#f4f1ec']);
    rect(ctx, cx - 1, cy - 50, 1, 6, '#e06c5a');
    ctx.globalAlpha = blink(t, 300) > 0.5 ? 1 : 0.25;
    rect(ctx, cx - 1, cy - 51, 2, 1, '#ff5a4a');
    ctx.globalAlpha = 1;
    return;
  }

  // level 3: 展望台つき・夜は光る
  shadow(ctx, cx, cy, 13);
  lattice(ctx, cx, cy, 58, 12, ['#e06c5a', '#f4f1ec']);
  rect(ctx, cx - 6, cy - 40, 12, 4, '#dfe6ec'); // 展望台
  rect(ctx, cx - 6, cy - 39, 12, 1, '#7fd3e8');
  rect(ctx, cx - 4, cy - 60, 8, 2, '#dfe6ec');
  rect(ctx, cx - 1, cy - 68, 1, 8, '#e06c5a');
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.35 + blink(t, 420, i * 1.3) * 0.65;
    rect(ctx, cx - 5 + i * 3, cy - 37, 1, 1, '#ffe06a');
  }
  ctx.globalAlpha = blink(t, 260) > 0.5 ? 1 : 0.25;
  rect(ctx, cx - 1, cy - 69, 2, 1, '#ff5a4a');
  ctx.globalAlpha = 1;
  smoke(ctx, cx + 14, cy - 4, t);
  person(ctx, cx - 14, cy + 1, t, '#5a86b8', 0.4);
  person(ctx, cx + 12, cy + 2, t, '#e07a5f', 1.7);
}

export function drawCityBuilding(
  ctx: CanvasRenderingContext2D,
  type: CityType,
  cx: number,
  cy: number,
  level: number,
  t: number,
): void {
  if (type === 'field') drawField(ctx, cx, cy, level, t);
  else if (type === 'postOffice') drawPostOffice(ctx, cx, cy, level, t);
  else if (type === 'school') drawSchool(ctx, cx, cy, level, t);
  else if (type === 'station') drawStation(ctx, cx, cy, level, t);
  else if (type === 'shoppingStreet') drawShoppingStreet(ctx, cx, cy, level, t);
  else if (type === 'office') drawOffice(ctx, cx, cy, level, t);
  else drawRadioTower(ctx, cx, cy, level, t);
}
