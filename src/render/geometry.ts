/** 区画の座標と world 座標（描画の論理座標）の対応。純粋関数。 */
import { parseCell } from '../core/grid';
import type { CellKey } from '../core/grid';
import { TILE_H, TILE_W } from './camera';
import type { Bounds } from './camera';

/** 建物が区画の上にはみ出す高さ（電波塔 Lv3 がおよそ 70） */
const BUILDING_HEADROOM = 72;
/** 外枠のまわりの余白 */
const PAD = 10;

export interface CellPos {
  cell: CellKey;
  x: number;
  y: number;
  /** 奥から手前に描くための順番（小さいほど奥） */
  depth: number;
}

/** 区画の座標 → ひし形の中心（world 座標） */
export function cellPositions(cells: CellKey[]): CellPos[] {
  const out: CellPos[] = [];
  for (const cell of cells) {
    const p = parseCell(cell);
    if (!p) continue;
    out.push({ cell, x: (p.x - p.y) * (TILE_W / 2), y: (p.x + p.y) * (TILE_H / 2), depth: p.x + p.y });
  }
  return out;
}

/** world 座標が、どの区画のひし形の中にあるか（重なりは手前を優先） */
export function cellAt(cells: CellKey[], wx: number, wy: number): CellKey | null {
  let found: CellKey | null = null;
  let bestDepth = -Infinity;
  for (const p of cellPositions(cells)) {
    const dx = Math.abs(wx - p.x) / (TILE_W / 2);
    const dy = Math.abs(wy - p.y) / (TILE_H / 2);
    if (dx + dy <= 1 && p.depth >= bestDepth) {
      bestDepth = p.depth;
      found = p.cell;
    }
  }
  return found;
}

/** 区画と建物の高さを含む外枠 */
export function landBounds(cells: CellKey[]): Bounds {
  const ps = cellPositions(cells);
  if (ps.length === 0) return { minX: -TILE_W, minY: -TILE_H - BUILDING_HEADROOM, maxX: TILE_W, maxY: TILE_H };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ps) {
    minX = Math.min(minX, p.x - TILE_W / 2);
    maxX = Math.max(maxX, p.x + TILE_W / 2);
    minY = Math.min(minY, p.y - TILE_H / 2 - BUILDING_HEADROOM);
    maxY = Math.max(maxY, p.y + TILE_H / 2);
  }
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
}
