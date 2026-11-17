# 開始時スター（30★） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新規プレイヤーが30★を持った状態で始まるようにする。

**Architecture:** 設定値 `STARTING_STARS` を `config.ts` に置き、`createNewSave()` の `stars` 初期値に使う。既存セーブの読み込み（`normalizeSave`）は変えない。

**Tech Stack:** TypeScript / Vite / Vitest

**Spec:** `docs/superpowers/specs/2026-11-17-starting-stars-design.md`

## Global Constraints

- 開始時スターは `30`。
- `totalEarnedStars` / `totalSpentStars` の初期値は `0` のまま。
- 既存セーブは変更しない。
- コミット・push は佐俣の指示があるまでしない。

## Review Focus

- 既存セーブの `stars: 0` を読み込んだとき、30★に上書きされないこと（`normalizeSave` は `num(o.stars, 0)` のまま）→ Task 1 Step 1 にテストあり。
- 壊れたセーブから作り直した場合は新規扱いで30★になる（仕様どおり。テスト不要）。

---

### Task 1: 開始時スター

**Files:**
- Modify: `src/core/config.ts`（`STARS_PER_MINUTE` の近くに定数追加、`ONBOARDING_STEPS[2].body`）
- Modify: `src/core/storage.ts:74`（`createNewSave` の `stars`）
- Modify: `README.md`（ゲーム内バランス表の前後に「開始時 30★」）
- Test: `tests/storage.test.ts`、既存の0★前提のテスト（`tests/rewards.test.ts` ほか）

**Interfaces:**
- Produces: `export const STARTING_STARS = 30;`（`src/core/config.ts`）

- [ ] **Step 1: 失敗するテストを書く**（`tests/storage.test.ts`）
  - `新規セーブは STARTING_STARS(30) で始まる`：`createNewSave(T0).stars === 30`、`totalEarnedStars === 0`、`totalSpentStars === 0`
  - `既存セーブの stars: 0 は 30 に上書きされない`：`stars: 0` を含むセーブを `normalizeSave` に通して `stars === 0`
- [ ] **Step 2: `npm test` で新規セーブのテストが失敗することを確認**
- [ ] **Step 3: `STARTING_STARS` を追加し、`createNewSave` で使う。説明3枚目の本文を「空いている区画をタップして、家・お店・公園を建てましょう。はじめに30★をプレゼント。さっそく1軒建ててみましょう。レベルを上げると見た目が変わります。」にする**
- [ ] **Step 4: `npm test` を実行し、0★前提で落ちた既存テストは初期値を明示的に `save.stars = 0` にするか期待値を合わせて直す**
- [ ] **Step 5: README のバランス表に開始時30★を追記**
- [ ] **Step 6: `npm test`・`npm run typecheck`・`npm run build` がすべて通ることを確認**
