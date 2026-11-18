import { describe, expect, it } from 'vitest';
import { INITIAL_CELLS } from '../src/core/config';
import { cellAt, cellPositions, landBounds } from '../src/render/geometry';

describe('区画の位置', () => {
  it('座標をひし形の中心（world 座標）に変える', () => {
    const [p] = cellPositions(['2,1']);
    expect(p).toEqual({ cell: '2,1', x: 24, y: 36, depth: 3 });
    expect(cellPositions(['0,0', 'a,b'])).toHaveLength(1);
  });

  it('cellAt はひし形の中だけを当たりにする', () => {
    expect(cellAt(INITIAL_CELLS, 24, 36)).toBe('2,1');
    expect(cellAt(INITIAL_CELLS, 0, 0)).toBe('0,0');
    expect(cellAt(INITIAL_CELLS, 0, -13)).toBeNull();
    expect(cellAt(['-1,0'], -24, -12)).toBe('-1,0');
  });

  it('landBounds は区画と建物の高さを含む外枠', () => {
    const b = landBounds(['0,0']);
    expect(b.minX).toBeLessThanOrEqual(-24);
    expect(b.maxX).toBeGreaterThanOrEqual(24);
    expect(b.maxY).toBeGreaterThanOrEqual(12);
    expect(b.minY).toBeLessThan(-12 - 30);
  });
});
