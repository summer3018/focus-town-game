import { describe, expect, it } from 'vitest';
import { BUILDING_ORDER } from '../src/core/config';
import type { BuildingType } from '../src/core/types';
import { drawBuilding } from '../src/render/sprites';

/** 呼ばれた描画命令と、塗った色だけを記録する偽の Canvas */
function fakeCtx() {
  const calls: string[] = [];
  const colors = new Set<string>();
  let minX = Infinity;
  let maxX = -Infinity;
  const track = (x: number, w = 0) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + w);
  };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return (...args: number[]) => {
        calls.push(prop);
        if (prop === 'fillRect') track(args[0]!, args[2]!);
        if (prop === 'moveTo' || prop === 'lineTo') track(args[0]!);
      };
    },
    set(_t, prop: string, value: unknown) {
      target[prop] = value;
      if (prop === 'fillStyle' && typeof value === 'string') colors.add(value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, colors, width: () => ({ minX, maxX }) };
}

const NEW_TYPES: BuildingType[] = ['field', 'postOffice', 'school', 'station', 'shoppingStreet', 'office', 'radioTower'];

describe('建物のドット絵', () => {
  it('10種すべて、Lv1〜3 で例外なく何かを描く', () => {
    for (const type of BUILDING_ORDER) {
      for (const level of [1, 2, 3]) {
        const f = fakeCtx();
        expect(() => drawBuilding(f.ctx, type, 0, 0, level, 1234)).not.toThrow();
        expect(f.calls.some((c) => c === 'fillRect' || c === 'fill')).toBe(true);
      }
    }
  });

  it('新しい建物は、家とは別の絵になる', () => {
    const house = fakeCtx();
    drawBuilding(house.ctx, 'house', 0, 0, 1, 0);
    const houseColors = [...house.colors].sort().join('|');
    for (const type of NEW_TYPES) {
      const f = fakeCtx();
      drawBuilding(f.ctx, type, 0, 0, 1, 0);
      expect([...f.colors].sort().join('|')).not.toBe(houseColors);
    }
  });

  it('10種はそれぞれ別の絵（同じレベルで比べて、どの2つも同じにならない）', () => {
    for (const level of [1, 2, 3]) {
      const sigs = BUILDING_ORDER.map((type) => {
        const f = fakeCtx();
        drawBuilding(f.ctx, type, 0, 0, level, 0);
        return f.calls.length + ':' + [...f.colors].sort().join('|');
      });
      expect(new Set(sigs).size).toBe(BUILDING_ORDER.length);
    }
  });

  it('レベルが上がると見た目が変わる', () => {
    for (const type of NEW_TYPES) {
      const sig = (level: number) => {
        const f = fakeCtx();
        drawBuilding(f.ctx, type, 0, 0, level, 0);
        return f.calls.length + ':' + [...f.colors].sort().join('|');
      };
      expect(sig(2)).not.toBe(sig(1));
      expect(sig(3)).not.toBe(sig(2));
    }
  });

  it('Lv3 でも横幅は区画から大きくはみ出さない（±26 以内）', () => {
    for (const type of NEW_TYPES) {
      const f = fakeCtx();
      drawBuilding(f.ctx, type, 0, 0, 3, 0);
      const { minX, maxX } = f.width();
      expect(minX).toBeGreaterThanOrEqual(-26);
      expect(maxX).toBeLessThanOrEqual(26);
    }
  });
});
