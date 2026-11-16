/**
 * Web Audio API だけで作る効果音（外部素材なし＝権利の心配がない）。
 * ブラウザの自動再生制限に合わせて、最初のタップまで AudioContext を作らない。
 */
export type SfxName =
  | 'tap'
  | 'back'
  | 'focusComplete'
  | 'star'
  | 'build'
  | 'levelUp'
  | 'catch'
  | 'combo'
  | 'miss';

interface Tone {
  freq: number;
  durationMs: number;
  type: OscillatorType;
  gain: number;
  /** 開始までの遅れ（ms） */
  delayMs?: number;
  /** 終了時の周波数（指定すると滑らかに動く） */
  toFreq?: number;
}

const SFX: Record<SfxName, Tone[]> = {
  tap: [{ freq: 660, durationMs: 60, type: 'sine', gain: 0.5 }],
  back: [{ freq: 420, durationMs: 70, type: 'sine', gain: 0.4 }],
  focusComplete: [
    { freq: 523.25, durationMs: 160, type: 'triangle', gain: 0.6 },
    { freq: 659.25, durationMs: 160, type: 'triangle', gain: 0.6, delayMs: 140 },
    { freq: 783.99, durationMs: 300, type: 'triangle', gain: 0.6, delayMs: 280 },
  ],
  star: [{ freq: 880, durationMs: 120, type: 'sine', gain: 0.5, toFreq: 1320 }],
  build: [
    { freq: 220, durationMs: 90, type: 'square', gain: 0.35 },
    { freq: 330, durationMs: 120, type: 'triangle', gain: 0.45, delayMs: 80 },
  ],
  levelUp: [
    { freq: 659.25, durationMs: 110, type: 'triangle', gain: 0.5 },
    { freq: 880, durationMs: 110, type: 'triangle', gain: 0.5, delayMs: 100 },
    { freq: 1174.66, durationMs: 220, type: 'triangle', gain: 0.5, delayMs: 200 },
  ],
  catch: [{ freq: 740, durationMs: 55, type: 'sine', gain: 0.45, toFreq: 980 }],
  combo: [{ freq: 980, durationMs: 90, type: 'triangle', gain: 0.5, toFreq: 1480 }],
  miss: [{ freq: 200, durationMs: 90, type: 'sine', gain: 0.3, toFreq: 140 }],
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.25;

  /** 最初のユーザー操作のときに呼ぶ */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    for (const tone of SFX[name]) {
      const start = ctx.currentTime + (tone.delayMs ?? 0) / 1000;
      const dur = tone.durationMs / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.toFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.toFreq), start + dur);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }
}

export const audio = new AudioEngine();
