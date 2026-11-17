# 広がる街（A） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6区画固定の街を、星で土地を買って上限なく広がる街にし、区画の数の節目で新しい建物と街の呼び名を解放する。

**Architecture:** 区画を整数座標 `"x,y"` で持つ保存データ v2 に移し、土地・節目の決まりを `src/core` の純粋関数にする。描画は今の Canvas 2D のまま、純粋なカメラ計算（`src/render/camera.ts`）を足して拡大・縮小・スクロールと画面内だけの描画を行う。

**Tech Stack:** TypeScript / Vite / Vitest（environment: node）/ Canvas 2D / localStorage / PWA

**Spec:** `docs/superpowers/specs/2026-11-18-expanding-town-design.md`

## Global Constraints

- 新しい依存を入れない。
- 調整値はすべて `src/core/config.ts`。
- 星は集中の報酬でしか増えない。土地・建物の購入は `stars` を減らし `totalSpentStars` を増やす。
- 今のプレイヤーの街・星・記録を失わない（v1→v2 移行）。
- 土地の値段 = `min(60, 15 + 5 × landPurchases)`。
- 区画の大きさ = ひし形の横幅（CSS px）。拡大範囲 32〜160px。56px 未満でのタップは選択せず拡大。起動時は土地全体が収まる倍率（ただし 56px 以上）、収まらなければ土地の外枠の中心を表示。
- 指の移動 8px 以上はドラッグ扱い。
- 節目と建物（spec の表どおり）：6 小さな村（house/shop/park）・12 村（field）・20 小さな町（postOffice）・30 町（school）・45 にぎやかな町（station）・65 市（shoppingStreet）・90 都市（office）・120 大都市（radioTower）。
- 新しい建物の値段（建設 / Lv2へ / Lv3へ）：field 25/35/70・postOffice 40/60/120・school 60/90/180・station 80/120/240・shoppingStreet 100/150/300・office 140/210/420・radioTower 200/300/600。
- コミットはタスクごと。push は佐俣の指示があるまでしない。

## Review Focus

1. v1 のセーブ（`buildings` のキーが `"0"`〜`"5"`、`land` なし）が、建物の位置・レベル・星を保ったまま v2 になる。v2 を2回 normalize しても変わらない → Task 1 にテスト。
2. 壊れた土地データ（`"1.5,2"`・`"a,b"`・重複・持っていない土地の上の建物・`land` が空）は捨てられ、最初の6区画は必ず残る → Task 1 にテスト。
3. 星が足りない／隣接していない／もう持っている土地の購入は、何も変えない → Task 2 にテスト。
4. 解放前の建物を直接 `build` しても建たない → Task 2 にテスト。
5. 指2本の拡大・縮小の最後に1本だけ離れたとき、タップとして扱われない → Task 4 にテスト。

---

### Task 1: 座標の区画と保存データ v2

**Files:**
- Create: `src/core/grid.ts`
- Modify: `src/core/types.ts`, `src/core/config.ts`, `src/core/storage.ts`, `src/core/buildings.ts`, `src/core/state.ts`, `src/core/analytics.ts`
- Modify（型を通すための最小限）: `src/render/town.ts`, `src/ui/app.ts`
- Test: `tests/grid.test.ts`（新規）, `tests/storage.test.ts`, `tests/buildings.test.ts`, `tests/state.test.ts`, `tests/analytics.test.ts`

**Interfaces:**
- Produces（`src/core/grid.ts`）:
  - `type CellKey = string`
  - `cellKey(x: number, y: number): CellKey` → `"x,y"`
  - `parseCell(key: string): { x: number; y: number } | null`（整数かつ絶対値 10000 以下のみ）
  - `neighbors4(key: CellKey): CellKey[]`（上下左右の順は 右・下・左・上）
  - `slotToCell(slot: number): CellKey` → `cellKey(slot % 3, Math.floor(slot / 3))`
- Produces（`config.ts`）: `INITIAL_CELLS: CellKey[] = ['0,0','1,0','2,0','0,1','1,1','2,1']`、`SAVE_VERSION = 2`。`SLOT_IDS` は削除。
- Produces（`types.ts`）: `SlotId` を削除。`SaveData.land: CellKey[]`、`SaveData.landPurchases: number`、`SaveData.buildings: Record<CellKey, PlacedBuilding>`。`LogEvent.slot` を `cell?: CellKey` に置き換え。
- Produces（`buildings.ts`）: `getBuilding/canBuild/canUpgrade/build/upgrade` の第2引数を `cell: CellKey` に。`canBuild` は `save.land` に含まれる空きセルのみ真。`townLevel/buildingCount` は `Object.values(save.buildings)` で数える。
- Produces（`state.ts`）: `construct(cell: CellKey, type, now)`、`upgradeCell(cell: CellKey, now)`（`upgradeSlot` を改名）。
- Produces（`analytics.ts`）: 要約の `buildings` を `{ cell: CellKey; type; level }[]` に、`landCount: number` を追加。`exportVersion` を 2 に。

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/grid.test.ts`：`cellKey(-1, 2) === '-1,2'`、`parseCell('3,-4')` → `{x:3,y:-4}`、`parseCell('1.5,2')`・`parseCell('a,b')`・`parseCell('1')`・`parseCell('99999,0')` → `null`、`neighbors4('0,0')` → `['1,0','0,1','-1,0','0,-1']`、`slotToCell(4) === '1,1'`。
  - `tests/storage.test.ts`：
    - `v1 のセーブを v2 に移す`：`{ version: 1, stars: 77, buildings: { '0': {type:'house',level:2,...}, '4': {type:'park',level:1,...} } }` → `version 2`・`land` が `INITIAL_CELLS` と同じ集合・`buildings['0,0'].level === 2`・`buildings['1,1'].type === 'park'`・`stars === 77`・`landPurchases === 0`。
    - `v2 は normalize を2回通しても同じ`：移行結果を `JSON.parse(JSON.stringify())` して再 normalize → `toEqual`。
    - `壊れた土地データを捨てる`：`land: ['0,0','1.5,2','a,b','0,0','5,5']`、`buildings: {'9,9': house}` → `land` に `'1.5,2'`・`'a,b'` なし、重複なし、`INITIAL_CELLS` を全部含む、`'5,5'` は残る、`buildings['9,9']` なし。
    - `land が空でも最初の6区画は残る`。
    - 新規セーブ：`land` が `INITIAL_CELLS`、`landPurchases === 0`。
  - 既存テストの `slot` 番号を座標キーに置き換える（`0` → `'0,0'` など）。
- [ ] **Step 2: `npm test` で新しいテストが落ちることを確認**
- [ ] **Step 3: 実装する**
  - v1 判定：`version` が 2 未満、または `land` が配列でない。そのとき `buildings` のキー `"0"`〜`"5"` を `slotToCell` で移す。
  - normalize の順：`land` を `parseCell` で検証・重複除去 → `INITIAL_CELLS` を足す → 建物は `land` に含まれるセルだけ残す。
  - `town.ts`：`slotPositions()` を `cellPositions(save.land)` に置き換え、位置は `x: ORIGIN_X + (x - y) * TILE_W/2`、`y: ORIGIN_Y + (x + y) * TILE_H/2`、`depth: x + y`。`selectedSlot` → `selectedCell: CellKey | null`、`hitSlot` → `hitCell`。カメラはまだ足さない（今の固定表示のまま）。
  - `app.ts`：区画番号の表示「区画 N」は「区画 (x, y)」ではなく「この区画」とする。`建物 N / 6` は `建物 N / 区画数` にする。
- [ ] **Step 4: `npm test`・`npm run typecheck` が通ることを確認**
- [ ] **Step 5: コミット** `feat: 区画を座標で持つ保存データ v2 に移行`

### Task 2: 土地の購入と節目

**Files:**
- Create: `src/core/land.ts`
- Modify: `src/core/config.ts`, `src/core/buildings.ts`, `src/core/state.ts`, `src/core/types.ts`
- Test: `tests/land.test.ts`（新規）, `tests/buildings.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: Task 1 の `CellKey`・`neighbors4`・`SaveData.land/landPurchases`。
- Produces（`config.ts`）:
  - `LAND_COST = { base: 15, step: 5, max: 60 }`
  - `TOWN_STAGES: { at: number; name: string; unlocks: BuildingType[] }[]`（Global Constraints の表どおり、`at` 昇順）
- Produces（`land.ts`）:
  - `landPrice(purchases: number): number`
  - `buyableCells(save: SaveData): CellKey[]`（重複なし、キー文字列でソート）
  - `canBuyLand(save: SaveData, cell: CellKey): boolean`
  - `buyLand(save: SaveData, cell: CellKey): { price: number } | null`
  - `townStage(landCount: number): { index: number; name: string; unlocked: BuildingType[]; next: { at: number; name: string; unlocks: BuildingType[] } | null }`
  - `isUnlocked(save: SaveData, type: BuildingType): boolean`
  - `stageReachedBy(beforeCount: number, afterCount: number): (typeof TOWN_STAGES)[number] | null`（越えた節目のうち最後のもの）
- Produces（`buildings.ts`）: `canBuild` は `isUnlocked` も条件にする。`townTitle(save)` は `townStage(save.land.length).name` を返す。
- Produces（`state.ts`）: `purchaseLand(cell: CellKey, now?: number): { price: number; stage: (typeof TOWN_STAGES)[number] | null } | null`。成功時にイベント `land_purchase`（`starsSpent`・`cell`・`landCount`）を記録して commit。
- Produces（`types.ts`）: `LogEventName` に `'land_purchase'`、`LogEvent.landCount?: number`。

- [ ] **Step 1: 失敗するテストを書く**（`tests/land.test.ts`）
  - `landPrice(0) === 15`、`landPrice(1) === 20`、`landPrice(9) === 60`、`landPrice(10) === 60`、`landPrice(100) === 60`。
  - 新規セーブの `buyableCells` は 10 個（3×2 の周り）で、`'3,0'`・`'-1,1'`・`'1,-1'`・`'1,2'` を含み、`'0,0'` と `'-1,-1'` を含まない。
  - `buyLand` 成功：stars 30 → 15、`totalSpentStars` +15、`landPurchases` 1、`land` に追加。
  - 星不足（stars 14）・隣接していない `'5,5'`・持っている `'0,0'` は `null` で、`stars`・`land`・`landPurchases` が変わらない。
  - `townStage(6).name === '小さな村'`、`townStage(11).next.at === 12`、`townStage(12).unlocked` に `'field'` を含む、`townStage(120).next === null`、`townStage(500).name === '大都市'`。
  - `stageReachedBy(11, 12).name === '村'`、`stageReachedBy(12, 13) === null`。
  - `buildings.test.ts`：stars 1000・区画 6 のとき `build(save, '0,0', 'field', T0) === null`。
  - `state.test.ts`：`purchaseLand` が `land_purchase` を記録し、11→12 区画で `stage.name === '村'` を返す。
- [ ] **Step 2: `npm test` で落ちることを確認**
- [ ] **Step 3: 実装する**（`BuildingType` に新しい7種を足すのは Task 3。ここでは `TOWN_STAGES` の型を通すため、`types.ts` の `BuildingType` に7種を先に足し、`BUILDINGS` には Task 3 で中身を入れる。Task 2 の時点では `BUILDINGS` に仮の spec を置いてよい）
- [ ] **Step 4: `npm test`・`npm run typecheck` が通ることを確認**
- [ ] **Step 5: コミット** `feat: 土地の購入と街の節目`

### Task 3: 新しい建物7種

**Files:**
- Modify: `src/core/config.ts`（`BUILDINGS`・`BUILDING_ORDER`）, `src/render/sprites.ts`
- Test: `tests/buildings.test.ts`, `tests/sprites.test.ts`（新規）

**Interfaces:**
- Consumes: Task 2 の `BuildingType`（10種）。
- Produces: `BUILDINGS` 10種すべて（name・summary・buildCost・upgradeCosts・maxLevel 3・levelNotes 3つ・accent・icon）。`BUILDING_ORDER` は解放順（house, shop, park, field, postOffice, school, station, shoppingStreet, office, radioTower）。`drawBuilding` は10種すべてを描く。

- [ ] **Step 1: 失敗するテストを書く**
  - `buildings.test.ts`：Global Constraints の値どおり `buildCost`・`upgradeCost` を7種ぶん確認。
  - `sprites.test.ts`：Canvas の代わりに、呼ばれたメソッドを数えるだけの偽 ctx（Proxy で全メソッドを no-op、`createLinearGradient` は `{ addColorStop(){} }` を返す）を作り、10種 × Lv1〜3 で `drawBuilding` が例外を出さず、`fillRect` か `fill` が1回以上呼ばれることを確認。今の house/shop/park とは別の描画（`fillStyle` に代入された色の集合が house と同じでない）であることも確認。
- [ ] **Step 2: `npm test` で落ちることを確認**
- [ ] **Step 3: 7種のドット絵を描く。** テーマは「田舎→都会」。Lv が上がると見た目が変わる。Lv3 の幅は区画のひし形（横 48）を大きく超えない（目安 ±26 以内）。ビル・電波塔は縦に高くしてよい。
- [ ] **Step 4: `npm test`・`npm run typecheck` が通ることを確認**
- [ ] **Step 5: コミット** `feat: 田舎から都会へ、新しい建物7種`

### Task 4: カメラと描画

**Files:**
- Create: `src/render/camera.ts`, `src/render/gestures.ts`
- Modify: `src/render/town.ts`
- Test: `tests/camera.test.ts`（新規）, `tests/gestures.test.ts`（新規）

**Interfaces:**
- Consumes: Task 1 の `cellPositions`・`CellKey`、Task 2 の `buyableCells`。
- Produces（`camera.ts`、純粋関数・DOM なし）:
  - `interface Camera { cx: number; cy: number; zoom: number }`（`cx, cy` は論理座標の画面中心、`zoom` は CSS px / 論理px）
  - `TILE_PX = { min: 32, max: 160, tapMin: 56 }`（config.ts に置く）
  - `tileWidthPx(cam: Camera): number` → `TILE_W * cam.zoom`
  - `clampZoom(zoom: number): number`（横幅 32〜160px に収める）
  - `fitCamera(bounds: {minX; minY; maxX; maxY}, viewW: number, viewH: number): Camera`（収まる倍率、ただし横幅 56px 以上。収まらなければ外枠の中心）
  - `screenToWorld(cam, viewW, viewH, sx, sy): {x, y}`／`worldToScreen(...)`
  - `zoomAt(cam, viewW, viewH, sx, sy, factor): Camera`（指の下の点を動かさずに拡大）
  - `panBy(cam, dxCss, dyCss): Camera`
  - `visibleBounds(cam, viewW, viewH, margin): {minX; minY; maxX; maxY}`
- Produces（`gestures.ts`、純粋なステートマシン）:
  - `createGestureTracker(): { down(id, x, y, t), move(id, x, y, t), up(id, x, y, t), cancel(id) }`。各呼び出しは `{ kind: 'none' } | { kind: 'pan'; dx; dy } | { kind: 'pinch'; cx; cy; factor } | { kind: 'tap'; x; y }` を返す。
  - 1本指で移動が 8px 未満のまま離した場合だけ `tap`。2本目が触れた時点でそのジェスチャーは二度と `tap` にならない（両方離れるまで）。
- Produces（`town.ts`）: `camera: Camera`。`fitToLand()`、`hitCell(clientX, clientY): CellKey | null`（持っている土地と買える土地の両方）、`isTapTooSmall(): boolean`。描画は `visibleBounds` の中のセルだけ。買える土地は薄い枠と「売地」の小さな印。空と島の背景は画面全体に広げる（島は持っている土地の形に沿わせる、細部は任せる）。タイトル画面用に `interactive: boolean` を持ち、false なら常に `fitToLand()`。

- [ ] **Step 1: 失敗するテストを書く**
  - `camera.test.ts`：`clampZoom` が 32/48・160/48 の範囲に収める。`fitCamera` に小さい外枠を渡すと土地が収まり、大きい外枠（200×200 セル相当）では `tileWidthPx === 56` かつ中心が外枠の中心。`zoomAt` 前後で指の下の world 座標が同じ（誤差 1e-6）。`screenToWorld(worldToScreen(p)) ≈ p`。
  - `gestures.test.ts`：移動 5px で離す → `tap`。移動 10px → `pan` のあと離しても `tap` にならない。2本指で開く → `pinch` の `factor > 1`。2本指のあと1本を離し、残りの1本を動かさずに離す → `tap` にならない（Review Focus 5）。
- [ ] **Step 2: `npm test` で落ちることを確認**
- [ ] **Step 3: 実装する。** ホイールは `zoomAt` に `factor = Math.exp(-deltaY / 400)`。慣性の有無は任せる。
- [ ] **Step 4: `npm test`・`npm run typecheck` が通ることを確認**
- [ ] **Step 5: コミット** `feat: 街の拡大・縮小・スクロールと画面内だけの描画`

### Task 5: 画面（購入・解放・案内）

**Files:**
- Modify: `src/ui/app.ts`, `index.html`, `src/styles.css`, `src/core/config.ts`（`ONBOARDING_STEPS` の文）, `README.md`

**Interfaces:**
- Consumes: Task 2 の `purchaseLand`・`townStage`・`isUnlocked`・`landPrice`、Task 4 の `createGestureTracker`・`hitCell`・`isTapTooSmall`・`zoomAt`・`fitToLand`。

- [ ] **Step 1: 街のキャンバスの入力を `createGestureTracker` につなぐ。** `tap` のとき、`isTapTooSmall()` なら `zoomAt` でその場所を横幅 56px 以上まで拡大して終わり。そうでなければ `hitCell`：持っている土地なら今の建設／強化シート、買える土地なら購入シート。キャンバスの CSS は `touch-action: none`。
- [ ] **Step 2: 購入シート。** タイトル「空き地」、本文「この土地を買うと、街が1区画広がります。」、ボタンに値段（`landPrice(save.landPurchases)`）と「買う」／「あと N★」。買ったら効果音 `build`・土ぼこり演出・トースト「土地が広がりました」。節目を越えたら、別のトースト「〈呼び名〉になりました！〈建物名〉が建てられるようになりました」と `celebrateStars` を出す。
- [ ] **Step 3: 建設シート。** 解放済みの建物を `BUILDING_ORDER` 順に並べ、その後ろに次の節目の建物を1つだけ鍵つき（押せない、「あと N区画で解放」）で出す。
- [ ] **Step 4: ホームの案内文。** `town-title` は `townTitle`、`town-sub` は「区画 N・建物 M」。`home-hint`：空き区画があり建てられる星があれば「光っている区画をタップすると建てられます。」、空き区画がなく土地を買える星があれば「街のまわりの売地をタップすると、街を広げられます。」、どちらも足りなければ「次の土地まであと N★」。
- [ ] **Step 5: 起動・画面サイズ変更・タイトル画面で `fitToLand()`。** 説明の3枚目の末尾に「街のまわりの土地を買うと、街が広がっていきます。」を足す。
- [ ] **Step 6: README** のバランス表・遊び方・設計の要点（座標の区画・v2 移行・カメラ）・「今後の課題」から「長期の目標がまだない」を外す。
- [ ] **Step 7: 確認。** `npm test`・`npm run typecheck`・`npm run build` が通る。`npm run preview` を Playwright で 390×844 で開き、新規状態で：土地を買う→区画が増える、ドラッグで動く、ホイールで拡大縮小、縮小しきった状態のタップで拡大される、ことを確認。
- [ ] **Step 8: コミット** `feat: 土地の購入画面と節目の解放の案内`
