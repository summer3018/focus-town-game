/** ゲーム全体で使う型定義 */

export type BuildingType =
  | 'house'
  | 'shop'
  | 'park'
  | 'field'
  | 'postOffice'
  | 'school'
  | 'station'
  | 'shoppingStreet'
  | 'office'
  | 'radioTower';

import type { CellKey } from './grid';

export interface PlacedBuilding {
  type: BuildingType;
  /** 1〜3 */
  level: number;
  /** 建設した時刻（epoch ms） */
  builtAt: number;
  /** 最後にレベルアップした時刻（epoch ms） */
  upgradedAt: number;
}

export type SessionStatus = 'running' | 'completed' | 'cancelled';

export interface FocusSession {
  id: string;
  /** 予定していた集中時間（分） */
  plannedMinutes: number;
  /** 予定していた集中時間（ms） */
  plannedMs: number;
  /** 開始時刻（epoch ms） */
  startedAt: number;
  /** 終了予定時刻（epoch ms） */
  endsAt: number;
  status: SessionStatus;
}

export interface RewardResult {
  sessionId: string;
  stars: number;
  plannedMinutes: number;
  /** 実際の経過時間（ms） */
  actualMs: number;
  claimedAt: number;
}

export interface SurveyAnswer {
  /** Q1 街が育つ仕組みは面白いか（1〜5） */
  fun: number;
  /** Q2 また使いたいか */
  reuse: 'yes' | 'no' | null;
  /** Q3 街づくりとミニゲームのどちらが楽しいか */
  prefer: 'town' | 'minigame' | 'both' | 'neither' | null;
  /** Q4 集中タイマーとして使いやすいか（1〜5） */
  usability: number;
  /** Q5 改善してほしい点（自由入力） */
  comment: string;
  answeredAt: number;
}

export interface GameSettings {
  soundOn: boolean;
  /** 0.0〜1.0 */
  volume: number;
}

export interface SaveData {
  version: number;
  /** 匿名のローカル識別子（端末内のみ・個人情報なし） */
  playerId: string;
  firstSeenAt: number;
  lastPlayedAt: number;
  /** 起動した日付（YYYY-MM-DD）の履歴。再訪計測用 */
  visitDays: string[];

  stars: number;
  totalEarnedStars: number;
  totalSpentStars: number;

  focusCount: number;
  focusCancelCount: number;
  totalFocusMs: number;

  /** 持っている土地（座標キー "x,y"） */
  land: CellKey[];
  /** これまでに星で買った土地の数（土地の値段の計算に使う） */
  landPurchases: number;
  /** 建物（キーは land に含まれる座標） */
  buildings: Record<CellKey, PlacedBuilding>;

  minigameBestScore: number;
  minigameBestCombo: number;
  minigamePlays: number;

  session: FocusSession | null;
  /** 報酬を受け取り済みのセッションID（二重受け取り防止） */
  claimedSessionIds: string[];
  /** 直近の報酬（完了画面の表示用。受け取り済みの記録そのもの） */
  lastReward: RewardResult | null;

  settings: GameSettings;
  onboarded: boolean;
  surveyPrompted: boolean;
  survey: SurveyAnswer | null;
}

export type LogEventName =
  | 'game_start'
  | 'focus_start'
  | 'focus_complete'
  | 'focus_cancel'
  | 'reward_claim'
  | 'building_construct'
  | 'building_upgrade'
  | 'minigame_start'
  | 'minigame_complete'
  | 'return_visit'
  | 'land_purchase';

export interface LogEvent {
  /** 発生時刻（epoch ms） */
  t: number;
  /** 発生時刻（ISO文字列・人が読む用） */
  iso: string;
  name: LogEventName;
  /** 匿名のローカル識別子 */
  pid: string;
  plannedMinutes?: number;
  elapsedMs?: number;
  starsGained?: number;
  starsSpent?: number;
  starsBalance?: number;
  buildingType?: BuildingType;
  buildingLevel?: number;
  cell?: CellKey;
  landCount?: number;
  score?: number;
  combo?: number;
  dayIndex?: number;
}
