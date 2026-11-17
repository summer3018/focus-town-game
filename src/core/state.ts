/**
 * ゲーム状態の持ち主。
 * 画面側はここ経由でのみセーブデータを触る（保存忘れ・二重付与を防ぐため）。
 */
import { appendEvent, buildExport, clearLog, readLog } from './analytics';
import type { LogPayload } from './analytics';
import { build as buildAt, buildCost, upgrade as upgradeAt, upgradeCost } from './buildings';
import { CUSTOM_MINUTES } from './config';
import { claimReward, createSessionId } from './rewards';
import { createNewSave, loadSave, persistSave, resolveStorage, todayKey } from './storage';
import type { StorageLike } from './storage';
import { clampMinutes, createSession, timerView } from './timer';
import type { BuildingType, LogEventName, RewardResult, SaveData, SurveyAnswer } from './types';
import type { CellKey } from './grid';

type Listener = () => void;

export class GameStore {
  save: SaveData;
  readonly storage: StorageLike;
  private listeners = new Set<Listener>();
  /** 読み込み時にデータを修復したか（設定画面で知らせる） */
  readonly wasRepaired: boolean;
  readonly isFirstRun: boolean;

  constructor(storage: StorageLike = resolveStorage(), now: number = Date.now()) {
    this.storage = storage;
    const result = loadSave(storage, now);
    this.save = result.save;
    this.wasRepaired = result.wasRepaired;
    this.isFirstRun = result.isNew;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** 変更したら必ずこれを呼ぶ */
  commit(): void {
    this.save.lastPlayedAt = Date.now();
    persistSave(this.storage, this.save);
    this.emit();
  }

  log(name: LogEventName, payload: LogPayload = {}): void {
    appendEvent(this.storage, this.save.playerId, name, { starsBalance: this.save.stars, ...payload });
  }

  /** 起動時の記録。日付が変わってからの再訪は return_visit として残す */
  recordStartup(now = Date.now()): void {
    const key = todayKey(now);
    const isReturn = !this.save.visitDays.includes(key) && this.save.visitDays.length > 0 && !this.isFirstRun;
    if (!this.save.visitDays.includes(key)) {
      this.save.visitDays.push(key);
      if (this.save.visitDays.length > 90) this.save.visitDays.shift();
    }
    this.log('game_start', { dayIndex: this.save.visitDays.length });
    if (isReturn) {
      this.log('return_visit', { dayIndex: this.save.visitDays.length });
    }
    this.commit();
  }

  // ---- 集中セッション ----

  startFocus(minutes: number, now = Date.now()): void {
    const safe = clampMinutes(minutes, CUSTOM_MINUTES.min, CUSTOM_MINUTES.max);
    this.save.session = createSession(safe, now, createSessionId(now));
    this.log('focus_start', { plannedMinutes: safe });
    this.commit();
  }

  cancelFocus(now = Date.now()): void {
    const session = this.save.session;
    if (!session) return;
    const view = timerView(session, now);
    this.save.focusCancelCount += 1;
    this.save.session = null;
    this.log('focus_cancel', { plannedMinutes: session.plannedMinutes, elapsedMs: view.rawElapsedMs });
    this.commit();
  }

  /**
   * タイマーが終わっていれば報酬を確定させる。
   * 受け取り済みのセッションでは二度目は起きない（claimReward が null を返す）。
   */
  completeFocusIfDue(now = Date.now()): RewardResult | null {
    const session = this.save.session;
    if (!session) return null;
    if (now < session.endsAt) return null;

    const view = timerView(session, now);
    const reward = claimReward(this.save, session, now);
    this.save.session = null;
    if (reward) {
      this.log('focus_complete', {
        plannedMinutes: session.plannedMinutes,
        elapsedMs: Math.min(view.rawElapsedMs, session.plannedMs),
      });
      this.log('reward_claim', { starsGained: reward.stars, plannedMinutes: session.plannedMinutes });
    }
    this.commit();
    return reward;
  }

  // ---- 街づくり ----

  construct(cell: CellKey, type: BuildingType, now = Date.now()): boolean {
    const cost = buildCost(type);
    const placed = buildAt(this.save, cell, type, now);
    if (!placed) return false;
    this.log('building_construct', {
      buildingType: type,
      buildingLevel: 1,
      cell,
      starsSpent: cost,
    });
    this.commit();
    return true;
  }

  upgradeCell(cell: CellKey, now = Date.now()): boolean {
    const before = this.save.buildings[cell];
    const cost = before ? upgradeCost(before.type, before.level) : null;
    const after = upgradeAt(this.save, cell, now);
    if (!after) return false;
    this.log('building_upgrade', {
      buildingType: after.type,
      buildingLevel: after.level,
      cell,
      starsSpent: cost ?? 0,
    });
    this.commit();
    return true;
  }

  // ---- ミニゲーム ----

  startMinigame(): void {
    this.save.minigamePlays += 1;
    this.log('minigame_start', {});
    this.commit();
  }

  finishMinigame(score: number, combo: number): { newBest: boolean } {
    const newBest = score > this.save.minigameBestScore;
    this.save.minigameBestScore = Math.max(this.save.minigameBestScore, score);
    this.save.minigameBestCombo = Math.max(this.save.minigameBestCombo, combo);
    this.log('minigame_complete', { score, combo });
    this.commit();
    return { newBest };
  }

  // ---- 設定・アンケート ----

  setSound(on: boolean): void {
    this.save.settings.soundOn = on;
    this.commit();
  }

  setVolume(v: number): void {
    this.save.settings.volume = Math.min(1, Math.max(0, v));
    this.commit();
  }

  markOnboarded(): void {
    this.save.onboarded = true;
    this.commit();
  }

  markSurveyPrompted(): void {
    this.save.surveyPrompted = true;
    this.commit();
  }

  saveSurvey(answer: SurveyAnswer): void {
    this.save.survey = answer;
    this.save.surveyPrompted = true;
    this.commit();
  }

  // ---- 記録の書き出し ----

  exportBundle(now = Date.now()) {
    return buildExport(this.save, readLog(this.storage), now);
  }

  eventCount(): number {
    return readLog(this.storage).length;
  }

  /** 記録をすべて消して最初からにする（設定画面から・確認つき） */
  resetAll(now = Date.now()): void {
    clearLog(this.storage);
    const fresh = createNewSave(now);
    fresh.playerId = this.save.playerId; // 匿名IDだけは引き継ぐ（再訪の検証のため）
    fresh.firstSeenAt = this.save.firstSeenAt;
    this.save = fresh;
    this.commit();
  }
}
