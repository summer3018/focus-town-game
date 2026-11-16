/**
 * スターキャッチの画面側。
 * ルールは core/minigameLogic.ts、ここは描画と入力だけを担当する。
 */
import { MINIGAME } from '../core/config';
import { Minigame } from '../core/minigameLogic';
import type { StarTarget } from '../core/minigameLogic';
import { audio } from '../core/audio';

interface Pop {
  x: number;
  y: number;
  text: string;
  bornAt: number;
  color: string;
}

interface Ripple {
  x: number;
  y: number;
  bornAt: number;
  hit: boolean;
}

export interface MinigameCallbacks {
  onTick: (remainingSec: number, score: number, combo: number) => void;
  onFanfare: (combo: number) => void;
  onFinish: (score: number, bestCombo: number) => void;
}

export class MinigameView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private game = new Minigame();
  private rafId = 0;
  private lastT = 0;
  private running = false;
  private pops: Pop[] = [];
  private ripples: Ripple[] = [];
  private cb: MinigameCallbacks;
  private startDelayMs = 0;
  private w = 1;
  private h = 1;

  constructor(canvas: HTMLCanvasElement, cb: MinigameCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2Dコンテキストを取得できませんでした');
    this.ctx = ctx;
    canvas.addEventListener('pointerdown', this.handlePointer);
  }

  private handlePointer = (ev: PointerEvent): void => {
    if (!this.running || this.startDelayMs > 0) return;
    ev.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / Math.max(1, rect.width);
    const y = (ev.clientY - rect.top) / Math.max(1, rect.height);
    // 当たり判定は指の太さを考えて少し広め
    const radius = 0.11;
    const result = this.game.tap(x, y, radius);
    this.ripples.push({ x, y, bornAt: performance.now(), hit: result.hit });

    if (result.hit) {
      audio.play(result.fanfare ? 'combo' : 'catch');
      this.pops.push({
        x,
        y,
        text: '+' + result.gained,
        bornAt: performance.now(),
        color: result.multiplier > 1 ? '#ffe08a' : '#ffffff',
      });
      if (result.fanfare) this.cb.onFanfare(result.combo);
    } else {
      audio.play('miss');
    }
  };

  resize(): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.w = this.canvas.width;
    this.h = this.canvas.height;
  }

  /** countdownMs のあいだはタップを受け付けずに待つ */
  start(countdownMs = 0): void {
    this.game.reset();
    this.pops = [];
    this.ripples = [];
    this.startDelayMs = countdownMs;
    this.resize();
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(100, t - this.lastT);
      this.lastT = t;
      if (this.startDelayMs > 0) {
        this.startDelayMs -= dt;
      } else {
        this.game.update(dt);
      }
      this.draw(t);
      const s = this.game.state;
      this.cb.onTick(Math.ceil(this.game.remainingMs / 1000), s.score, s.combo);
      if (s.finished) {
        this.running = false;
        this.cb.onFinish(s.score, s.bestCombo);
        return;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  get score(): number {
    return this.game.state.score;
  }

  get bestCombo(): number {
    return this.game.state.bestCombo;
  }

  private draw(t: number): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const unit = Math.min(this.w, this.h);

    // 背景の星くず
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 26; i += 1) {
      const x = ((i * 97) % 100) / 100;
      const y = ((i * 53) % 100) / 100;
      const tw = (Math.sin(t / 900 + i) + 1) / 2;
      ctx.globalAlpha = 0.08 + tw * 0.16;
      ctx.fillRect(x * this.w, y * this.h, 2, 2);
    }
    ctx.globalAlpha = 1;

    // コンボ中は画面の縁が光る
    const combo = this.game.state.combo;
    if (combo >= MINIGAME.comboStep) {
      const strength = Math.min(1, combo / (MINIGAME.comboStep * 4));
      const grad = ctx.createRadialGradient(this.w / 2, this.h / 2, unit * 0.2, this.w / 2, this.h / 2, unit * 0.78);
      grad.addColorStop(0, 'rgba(255,224,138,0)');
      grad.addColorStop(1, 'rgba(255,200,90,' + (0.1 + strength * 0.22).toFixed(3) + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    for (const star of this.game.state.stars) {
      this.drawStar(ctx, star, unit);
    }

    // タップの波紋
    this.ripples = this.ripples.filter((r) => t - r.bornAt < 420);
    for (const r of this.ripples) {
      const k = (t - r.bornAt) / 420;
      ctx.strokeStyle = r.hit ? 'rgba(255,224,138,' + (1 - k).toFixed(2) + ')' : 'rgba(255,255,255,' + (0.4 * (1 - k)).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x * this.w, r.y * this.h, unit * 0.03 + k * unit * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 得点の表示
    this.pops = this.pops.filter((p) => t - p.bornAt < 760);
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      const k = (t - p.bornAt) / 760;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      ctx.font = 'bold ' + Math.round(unit * 0.065) + 'px sans-serif';
      ctx.fillText(p.text, p.x * this.w, p.y * this.h - k * unit * 0.12);
    }
    ctx.globalAlpha = 1;
  }

  private drawStar(ctx: CanvasRenderingContext2D, star: StarTarget, unit: number): void {
    const age = this.game.state.elapsedMs - star.bornAt;
    const life = age / star.lifetimeMs;
    const baseR = unit * (star.size === 'small' ? 0.045 : 0.068);
    // 出るときにふくらみ、消える直前に縮む
    const appear = Math.min(1, age / 160);
    const vanish = life > 0.8 ? 1 - (life - 0.8) / 0.2 : 1;
    const r = baseR * (0.6 + appear * 0.4) * (0.6 + vanish * 0.4);
    const x = star.x * this.w;
    const y = star.y * this.h;

    // のこり時間のリング
    ctx.strokeStyle = life > 0.75 ? 'rgba(255,140,120,0.85)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - life));
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(255, 214, 120, 0.9)';
    ctx.shadowBlur = star.size === 'small' ? 14 : 20;
    ctx.fillStyle = star.size === 'small' ? '#fff3c4' : '#ffd766';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
