import { describe, expect, it } from 'vitest';
import { cellKey, neighbors4, parseCell, slotToCell } from '../src/core/grid';

describe('座標の区画', () => {
  it('cellKey は "x,y" の文字列を作る', () => {
    expect(cellKey(-1, 2)).toBe('-1,2');
  });

  it('parseCell は整数の座標だけを読む', () => {
    expect(parseCell('3,-4')).toEqual({ x: 3, y: -4 });
    expect(parseCell('1.5,2')).toBeNull();
    expect(parseCell('a,b')).toBeNull();
    expect(parseCell('1')).toBeNull();
    expect(parseCell('99999,0')).toBeNull();
    expect(parseCell('1,2,3')).toBeNull();
  });

  it('neighbors4 は 右・下・左・上 の順で返す', () => {
    expect(neighbors4('0,0')).toEqual(['1,0', '0,1', '-1,0', '0,-1']);
  });

  it('slotToCell は今の区画番号を座標に移す', () => {
    expect(slotToCell(0)).toBe('0,0');
    expect(slotToCell(2)).toBe('2,0');
    expect(slotToCell(4)).toBe('1,1');
    expect(slotToCell(5)).toBe('2,1');
  });
});
