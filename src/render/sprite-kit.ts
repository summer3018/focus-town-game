/** 建物のドット絵で使う、小さな描画の部品 */

const SHADOW = 'rgba(60, 70, 60, 0.18)';

export function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, w, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function roof(ctx: CanvasRenderingContext2D, cx: number, topY: number, halfW: number, h: number, color: string, edge: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + halfW, topY + h);
  ctx.lineTo(cx - halfW, topY + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = edge;
  ctx.fillRect(Math.round(cx - halfW), Math.round(topY + h - 1), Math.round(halfW * 2), 1);
}

export function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i += 1) {
    const phase = ((t / 900 + i * 0.33) % 1);
    const yy = y - phase * 13;
    const alpha = 0.45 * (1 - phase);
    ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
    const s = 1 + Math.round(phase * 2);
    ctx.fillRect(Math.round(x + Math.sin(phase * 5 + i) * 1.5), Math.round(yy), s, s);
  }
}

export function person(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, hue: string, offset: number): void {
  const bob = Math.sin(t / 420 + offset) > 0 ? 0 : 1;
  rect(ctx, x, y - 4 - bob, 2, 3, hue); // 体
  rect(ctx, x, y - 6 - bob, 2, 2, '#f0cfae'); // 頭
}

export function tree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number): void {
  const sway = Math.sin(t / 900 + seed) * 0.6;
  rect(ctx, x, y - size * 0.45, 2, size * 0.45, '#8a5f3c');
  ctx.fillStyle = '#4f9a52';
  ctx.beginPath();
  ctx.ellipse(x + 1 + sway, y - size * 0.72, size * 0.52, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6fb86a';
  ctx.beginPath();
  ctx.ellipse(x + 0.2 + sway, y - size * 0.8, size * 0.33, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function flower(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  rect(ctx, x, y - 2, 1, 2, '#5fa05c');
  rect(ctx, x - 1, y - 3, 3, 1, color);
  rect(ctx, x, y - 4, 1, 1, color);
}
