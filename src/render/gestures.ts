/**
 * 指の動きを「タップ・ドラッグ・つまむ」に見分ける（純粋なステートマシン）。
 * 座標は CSS px。DOM のイベントは呼び出し側でこの関数に渡す。
 */

/** これ以上動いたらタップではなくドラッグ */
export const TAP_SLOP_PX = 8;

export type GestureResult =
  | { kind: 'none' }
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'pinch'; cx: number; cy: number; factor: number; dx: number; dy: number }
  | { kind: 'tap'; x: number; y: number };

export interface GestureTracker {
  down(id: number, x: number, y: number, t: number): GestureResult;
  move(id: number, x: number, y: number, t: number): GestureResult;
  up(id: number, x: number, y: number, t: number): GestureResult;
  cancel(id: number): GestureResult;
  /** 残っている指を全部忘れる（画面を離れたときなど） */
  reset(): void;
}

type Mode = 'idle' | 'maybeTap' | 'pan' | 'pinch';

const NONE: GestureResult = { kind: 'none' };

export function createGestureTracker(): GestureTracker {
  const pts = new Map<number, { x: number; y: number }>();
  let mode: Mode = 'idle';
  let start = { x: 0, y: 0 };
  let lastDist = 0;
  let lastCenter = { x: 0, y: 0 };

  const pair = () => {
    const [a, b] = [...pts.values()];
    return {
      dist: Math.hypot(b!.x - a!.x, b!.y - a!.y),
      center: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 },
    };
  };

  const resetPinch = () => {
    if (pts.size >= 2) {
      const p = pair();
      lastDist = p.dist;
      lastCenter = p.center;
    }
  };

  return {
    down(id, x, y) {
      pts.set(id, { x, y });
      // 指が1本だけなら、前の操作の取りこぼしがあっても新しいタップとして始める
      if (pts.size === 1) {
        mode = 'maybeTap';
        start = { x, y };
      } else if (pts.size >= 2) {
        mode = 'pinch';
        resetPinch();
      }
      return NONE;
    },

    move(id, x, y) {
      const prev = pts.get(id);
      if (!prev) return NONE;
      pts.set(id, { x, y });

      if (mode === 'maybeTap') {
        if (Math.hypot(x - start.x, y - start.y) < TAP_SLOP_PX) return NONE;
        mode = 'pan';
        return { kind: 'pan', dx: x - start.x, dy: y - start.y };
      }
      if (mode === 'pan') return { kind: 'pan', dx: x - prev.x, dy: y - prev.y };
      if (mode === 'pinch') {
        if (pts.size < 2) return { kind: 'pan', dx: x - prev.x, dy: y - prev.y };
        const p = pair();
        const factor = lastDist > 0 ? p.dist / lastDist : 1;
        const r: GestureResult = {
          kind: 'pinch',
          cx: p.center.x,
          cy: p.center.y,
          factor,
          dx: p.center.x - lastCenter.x,
          dy: p.center.y - lastCenter.y,
        };
        lastDist = p.dist;
        lastCenter = p.center;
        return r;
      }
      return NONE;
    },

    up(id, x, y) {
      if (!pts.has(id)) return NONE;
      pts.delete(id);
      if (pts.size > 0) {
        // つまむ途中で1本離れた：残りの指はドラッグ扱い（タップにはしない）
        if (mode === 'pinch') resetPinch();
        return NONE;
      }
      const wasTap = mode === 'maybeTap';
      mode = 'idle';
      return wasTap ? { kind: 'tap', x, y } : NONE;
    },

    cancel(id) {
      pts.delete(id);
      if (pts.size === 0) mode = 'idle';
      else if (mode === 'maybeTap') mode = 'pan';
      return NONE;
    },

    reset() {
      pts.clear();
      mode = 'idle';
    },
  };
}
