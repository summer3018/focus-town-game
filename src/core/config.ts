/**
 * ゲームバランスの設定値。
 * 市場検証中に調整する数字は、すべてこのファイルに集めてある。
 */
import type { BuildingType, SlotId } from './types';

export const STORAGE_KEYS = {
  save: 'focus-town:save:v1',
  log: 'focus-town:log:v1',
} as const;

export const SAVE_VERSION = 1;

/** 集中時間のプリセット（分）。先頭が初期選択 */
export const FOCUS_PRESETS = [5, 15, 25] as const;

/** カスタム集中時間の範囲（分） */
export const CUSTOM_MINUTES = { min: 1, max: 60, default: 10 } as const;

/** プリセットごとの獲得スター（仮のバランス） */
export const PRESET_REWARDS: Record<number, number> = {
  5: 10,
  15: 30,
  25: 50,
};

/** プリセット以外（カスタム）の1分あたりの獲得スター */
export const STARS_PER_MINUTE = 2;

/** 新規プレイヤーが最初に持っているスター（最初の1軒をすぐ建てられる量） */
export const STARTING_STARS = 30;

/** 報酬を受け取り済みのセッションIDを保持する上限 */
export const MAX_CLAIMED_HISTORY = 100;

/** プレイログの保存上限（これを超えたら古いものから捨てる） */
export const LOG_LIMIT = 500;

/** 街の区画数 */
export const SLOT_IDS: SlotId[] = [0, 1, 2, 3, 4, 5];

export interface BuildingSpec {
  type: BuildingType;
  name: string;
  summary: string;
  /** 建設費用（スター） */
  buildCost: number;
  /** [Lv1→Lv2, Lv2→Lv3] の強化費用 */
  upgradeCosts: [number, number];
  maxLevel: number;
  /** レベルごとの説明 */
  levelNotes: [string, string, string];
  /** UI の色 */
  accent: string;
  icon: string;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  house: {
    type: 'house',
    name: '小さな家',
    summary: '街に住む人が増える。街のにぎやかさの土台。',
    buildCost: 20,
    upgradeCosts: [30, 60],
    maxLevel: 3,
    levelNotes: [
      '小さな平屋。窓がひとつ。',
      '煙突つきの家。窓が増えて、煙が立ちのぼる。',
      '二階建て。柵と住人があらわれて、生活感が出る。',
    ],
    accent: '#d98b6a',
    icon: '🏠',
  },
  shop: {
    type: 'shop',
    name: '小さなお店',
    summary: '街に彩りが出る。成長すると看板と人が増える。',
    buildCost: 30,
    upgradeCosts: [45, 90],
    maxLevel: 3,
    levelNotes: [
      '屋台のような小さな店。しま模様の日よけ。',
      '看板がついて、扉のあるお店になる。',
      '大きな看板と旗。お客さんが出入りする。',
    ],
    accent: '#e0a33e',
    icon: '🏪',
  },
  park: {
    type: 'park',
    name: '公園',
    summary: '街の雰囲気が明るくなる。木と花が増えていく。',
    buildCost: 20,
    upgradeCosts: [30, 60],
    maxLevel: 3,
    levelNotes: [
      '木が一本。小さな芝生。',
      '木が二本と花。ベンチが置かれる。',
      '木が三本と池。水面がきらめく。',
    ],
    accent: '#5fa86b',
    icon: '🌳',
  },
};

export const BUILDING_ORDER: BuildingType[] = ['house', 'shop', 'park'];

/** ミニゲーム「スターキャッチ」の設定 */
export const MINIGAME = {
  durationMs: 60_000,
  /** 星の表示時間（開始時 → 終了時にかけて短くなる） */
  lifetimeStartMs: 1700,
  lifetimeEndMs: 800,
  /** 同時に出る星の最大数 */
  maxConcurrentStart: 3,
  maxConcurrentEnd: 5,
  /** 星の出現間隔 */
  spawnIntervalStartMs: 620,
  spawnIntervalEndMs: 330,
  /** 基礎点 */
  baseScore: 10,
  /** コンボ倍率 = 1 + floor(combo / comboStep) * comboBonus（上限 comboMaxMultiplier） */
  comboStep: 5,
  comboBonus: 0.5,
  comboMaxMultiplier: 3,
  /** 小さい星のボーナス倍率 */
  smallStarMultiplier: 1.6,
  /** 「気持ちいい演出」が出るコンボ数 */
  fanfareCombo: 10,
  /** ハイスコア演出のしきい値 */
  greatScore: 800,
} as const;

/** 初回オンボーディングの文言 */
export const ONBOARDING_STEPS = [
  {
    title: 'がんばった時間が、街になる。',
    body: '集中した時間のぶんだけスターがたまります。まずは5分から試せます。',
  },
  {
    title: '集中中は、何もしなくていい',
    body: 'タイマーを動かしたら、画面を閉じて目の前の作業に戻ってください。時間は実時刻で数えています。',
  },
  {
    title: 'スターで街を育てる',
    body: '空いている区画をタップして、家・お店・公園を建てましょう。はじめに30★をプレゼント。さっそく1軒建ててみましょう。レベルを上げると見た目が変わります。',
  },
] as const;
