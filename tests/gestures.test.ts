import { describe, expect, it } from 'vitest';
import { createGestureTracker } from '../src/render/gestures';

describe('タップ・ドラッグ・つまむ の見分け', () => {
  it('ほとんど動かさずに離すとタップ', () => {
    const g = createGestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.move(1, 104, 103, 10).kind).toBe('none');
    expect(g.up(1, 104, 103, 20)).toEqual({ kind: 'tap', x: 104, y: 103 });
  });

  it('8px 以上動いたらドラッグで、離してもタップにならない', () => {
    const g = createGestureTracker();
    g.down(1, 100, 100, 0);
    const r = g.move(1, 110, 100, 10);
    expect(r).toEqual({ kind: 'pan', dx: 10, dy: 0 });
    expect(g.move(1, 115, 98, 20)).toEqual({ kind: 'pan', dx: 5, dy: -2 });
    g.move(1, 101, 100, 30); // 元の位置近くに戻っても
    expect(g.up(1, 101, 100, 40).kind).toBe('none');
  });

  it('2本指で広げると拡大', () => {
    const g = createGestureTracker();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 0);
    const r = g.move(2, 250, 100, 10);
    expect(r.kind).toBe('pinch');
    if (r.kind === 'pinch') {
      expect(r.factor).toBeCloseTo(1.5);
      expect(r.cx).toBeCloseTo(175);
      expect(r.cy).toBeCloseTo(100);
    }
  });

  it('つまんだあと1本離し、残りの1本を動かさずに離してもタップにならない', () => {
    const g = createGestureTracker();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 0);
    g.move(2, 220, 100, 10);
    expect(g.up(2, 220, 100, 20).kind).toBe('none');
    expect(g.up(1, 100, 100, 30).kind).toBe('none');
  });

  it('つまんだあと残った1本で動かすとドラッグ', () => {
    const g = createGestureTracker();
    g.down(1, 100, 100, 0);
    g.down(2, 200, 100, 0);
    g.up(2, 200, 100, 10);
    expect(g.move(1, 103, 100, 20)).toEqual({ kind: 'pan', dx: 3, dy: 0 });
  });

  it('全部離したあとは、次の1本でまたタップできる', () => {
    const g = createGestureTracker();
    g.down(1, 0, 0, 0);
    g.down(2, 50, 0, 0);
    g.up(1, 0, 0, 10);
    g.up(2, 50, 0, 10);
    g.down(3, 10, 10, 100);
    expect(g.up(3, 10, 10, 110).kind).toBe('tap');
  });

  it('cancel されたらタップにしない', () => {
    const g = createGestureTracker();
    g.down(1, 0, 0, 0);
    g.cancel(1);
    expect(g.up(1, 0, 0, 10).kind).toBe('none');
  });
});
