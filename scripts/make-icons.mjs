/**
 * ホーム画面用アイコンを生成する（外部ライブラリなし）。
 * Node の zlib だけで PNG を書き出すので、追加の依存はいらない。
 *
 *   node scripts/make-icons.mjs
 *
 * 出力先は public/ 。ゲーム本編と同じ色づかいで、島と家と星を描く。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// ---------- 最小限の PNG エンコーダ ----------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // フィルタなし
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 描画の道具（座標は 0〜1 の相対値） ----------

function createCanvas(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    if (a >= 255) {
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
      return;
    }
    const k = a / 255;
    px[i] = Math.round(px[i] * (1 - k) + r * k);
    px[i + 1] = Math.round(px[i + 1] * (1 - k) + g * k);
    px[i + 2] = Math.round(px[i + 2] * (1 - k) + b * k);
    px[i + 3] = Math.max(px[i + 3], Math.round(255 * k));
  };
  return { px, size, set };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** 縦のグラデーションで全面を塗る */
function fillGradient(cv, topHex, bottomHex) {
  const a = hex(topHex);
  const b = hex(bottomHex);
  for (let y = 0; y < cv.size; y += 1) {
    const t = y / (cv.size - 1);
    const c = [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
    for (let x = 0; x < cv.size; x += 1) cv.set(x, y, c);
  }
}

/** 等角の菱形（上面） */
function fillDiamond(cv, cx, cy, hw, hh, color) {
  const c = hex(color);
  const s = cv.size;
  const X = cx * s;
  const Y = cy * s;
  const HW = hw * s;
  const HH = hh * s;
  for (let y = Math.floor(Y - HH); y <= Math.ceil(Y + HH); y += 1) {
    for (let x = Math.floor(X - HW); x <= Math.ceil(X + HW); x += 1) {
      const d = Math.abs(x + 0.5 - X) / HW + Math.abs(y + 0.5 - Y) / HH;
      if (d <= 1) cv.set(x, y, c, d > 0.94 ? 150 : 255);
    }
  }
}

/** 島の土の側面 */
function fillSoil(cv, cx, cy, hw, hh, depth, color) {
  const c = hex(color);
  const s = cv.size;
  const X = cx * s;
  const Y = cy * s;
  const HW = hw * s;
  const HH = hh * s;
  const D = depth * s;
  for (let y = Math.floor(Y - HH); y <= Math.ceil(Y + HH + D); y += 1) {
    for (let x = Math.floor(X - HW); x <= Math.ceil(X + HW); x += 1) {
      const dx = Math.abs(x + 0.5 - X) / HW;
      const topEdge = Y + HH * (1 - dx);
      if (y + 0.5 >= topEdge && y + 0.5 <= topEdge + D && dx <= 1) cv.set(x, y, c);
    }
  }
}

function fillRect(cv, x0, y0, w, h, color) {
  const c = hex(color);
  const s = cv.size;
  for (let y = Math.round(y0 * s); y < Math.round((y0 + h) * s); y += 1) {
    for (let x = Math.round(x0 * s); x < Math.round((x0 + w) * s); x += 1) cv.set(x, y, c);
  }
}

/** 三角の屋根 */
function fillRoof(cv, cx, topY, hw, h, color) {
  const c = hex(color);
  const s = cv.size;
  const X = cx * s;
  const T = topY * s;
  const HW = hw * s;
  const H = h * s;
  for (let y = Math.floor(T); y <= Math.ceil(T + H); y += 1) {
    const k = (y - T) / H;
    const half = HW * k;
    for (let x = Math.floor(X - half); x <= Math.ceil(X + half); x += 1) cv.set(x, y, c);
  }
}

/** 五芒星 */
function fillStar(cv, cx, cy, r, color) {
  const c = hex(color);
  const s = cv.size;
  const X = cx * s;
  const Y = cy * s;
  const R = r * s;
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? R : R * 0.44;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push([X + Math.cos(a) * rad, Y + Math.sin(a) * rad]);
  }
  const inside = (x, y) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  for (let y = Math.floor(Y - R); y <= Math.ceil(Y + R); y += 1) {
    for (let x = Math.floor(X - R); x <= Math.ceil(X + R); x += 1) {
      // 2x2 のサンプリングで輪郭をなめらかにする
      let n = 0;
      for (const ox of [0.25, 0.75]) for (const oy of [0.25, 0.75]) if (inside(x + ox, y + oy)) n += 1;
      if (n > 0) cv.set(x, y, c, Math.round((n / 4) * 255));
    }
  }
}

// ---------- アイコンの絵 ----------

/**
 * @param {number} size 出力サイズ
 * @param {number} inset 中身をどれだけ内側に寄せるか（マスカブル用の安全余白）
 */
function drawIcon(size, inset = 0) {
  const cv = createCanvas(size);
  fillGradient(cv, '#d9ecf5', '#f3e7d4');

  // inset のぶん中身を縮めて中央に寄せる
  const k = 1 - inset * 2;
  const m = (v) => 0.5 + (v - 0.5) * k;
  const ms = (v) => v * k;

  // 島
  fillSoil(cv, 0.5, m(0.60), ms(0.40), ms(0.20), ms(0.075), '#966e4a');
  fillDiamond(cv, 0.5, m(0.60), ms(0.40), ms(0.20), '#8fcb7c');
  fillDiamond(cv, m(0.44), m(0.565), ms(0.21), ms(0.105), '#a4d88d');

  // 家
  fillRect(cv, m(0.5) - ms(0.115), m(0.60) - ms(0.145), ms(0.23), ms(0.155), '#f6e6cd');
  fillRect(cv, m(0.5) + ms(0.055), m(0.60) - ms(0.145), ms(0.06), ms(0.155), '#e2cbab');
  fillRoof(cv, m(0.5), m(0.60) - ms(0.265), ms(0.165), ms(0.12), '#cc7257');
  fillRect(cv, m(0.5) - ms(0.075), m(0.60) - ms(0.115), ms(0.055), ms(0.055), '#89c8e3');
  fillRect(cv, m(0.5) + ms(0.015), m(0.60) - ms(0.075), ms(0.045), ms(0.075), '#9a6a46');

  // 星
  fillStar(cv, m(0.775), m(0.235), ms(0.115), '#e8b53a');
  fillStar(cv, m(0.775), m(0.235), ms(0.055), '#ffd766');

  return encodePng(size, size, cv.px);
}

mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  ['icon-192.png', drawIcon(192)],
  ['icon-512.png', drawIcon(512)],
  ['icon-maskable-512.png', drawIcon(512, 0.11)],
  ['apple-touch-icon.png', drawIcon(180)],
  ['favicon-32.png', drawIcon(32)],
];

for (const [name, buf] of outputs) {
  writeFileSync(join(OUT_DIR, name), buf);
  console.log('wrote public/' + name + ' (' + buf.length + ' bytes)');
}
