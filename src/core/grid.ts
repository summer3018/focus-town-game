/** 街の区画を整数の座標 "x,y" で扱うための関数 */

export type CellKey = string;

/** 座標として受け付ける絶対値の上限（壊れたデータで巨大な座標を作らないため） */
const MAX_COORD = 10000;

export function cellKey(x: number, y: number): CellKey {
  return x + ',' + y;
}

export function parseCell(key: string): { x: number; y: number } | null {
  if (typeof key !== 'string') return null;
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return null;
  // "-0" を "0" にそろえる
  return { x: x + 0, y: y + 0 };
}

/** 上下左右のとなり（右・下・左・上の順） */
export function neighbors4(key: CellKey): CellKey[] {
  const p = parseCell(key);
  if (!p) return [];
  return [cellKey(p.x + 1, p.y), cellKey(p.x, p.y + 1), cellKey(p.x - 1, p.y), cellKey(p.x, p.y - 1)];
}

/** v1 の区画番号（0〜5、横3×縦2）を座標に移す */
export function slotToCell(slot: number): CellKey {
  return cellKey(slot % 3, Math.floor(slot / 3));
}
