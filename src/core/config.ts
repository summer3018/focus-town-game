/**
 * ゲームバランスの設定値。
 * 市場検証中に調整する数字は、すべてこのファイルに集めてある。
 */
import type { CellKey } from './grid';
import type { BuildingType } from './types';

export const STORAGE_KEYS = {
  save: 'focus-town:save:v1',
  log: 'focus-town:log:v1',
} as const;

export const SAVE_VERSION = 2;

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

/** 最初から持っている区画（横3×縦2。v1 の区画番号 0〜5 と同じ並び） */
export const INITIAL_CELLS: CellKey[] = ['0,0', '1,0', '2,0', '0,1', '1,1', '2,1'];

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
  field: {
    type: 'field',
    name: '田んぼ・畑',
    summary: '村の食べものを育てる。季節の色が街に出る。',
    buildCost: 25,
    upgradeCosts: [35, 70],
    maxLevel: 3,
    levelNotes: [
      '小さな畑。苗がならぶ。',
      '田んぼに水が張られ、かかしが立つ。',
      '実りの田んぼ。小屋と稲架がならぶ。',
    ],
    accent: '#9cbf5a',
    icon: '🌾',
  },
  postOffice: {
    type: 'postOffice',
    name: '郵便局',
    summary: '手紙と荷物が行き来する。町の入口になる。',
    buildCost: 40,
    upgradeCosts: [60, 120],
    maxLevel: 3,
    levelNotes: [
      '赤いポストのある小さな郵便局。',
      '看板と窓口が増え、自転車がとまる。',
      '二階建ての郵便局。配達のバイクが走る。',
    ],
    accent: '#d9534f',
    icon: '📮',
  },
  school: {
    type: 'school',
    name: '学校',
    summary: '子どもたちが集まる。町がにぎやかになる。',
    buildCost: 60,
    upgradeCosts: [90, 180],
    maxLevel: 3,
    levelNotes: [
      '木造の小さな校舎。',
      '校庭と鉄棒ができる。',
      '時計のついた大きな校舎。',
    ],
    accent: '#e0b25c',
    icon: '🏫',
  },
  station: {
    type: 'station',
    name: '駅',
    summary: '人が出入りする。町が外とつながる。',
    buildCost: 80,
    upgradeCosts: [120, 240],
    maxLevel: 3,
    levelNotes: [
      '小さな無人駅。ホームがひとつ。',
      '駅舎ができて、電車がとまる。',
      '屋根つきの大きな駅。人が行き交う。',
    ],
    accent: '#6b8fb8',
    icon: '🚉',
  },
  shoppingStreet: {
    type: 'shoppingStreet',
    name: '商店街',
    summary: 'お店がならび、町の顔になる。',
    buildCost: 100,
    upgradeCosts: [150, 300],
    maxLevel: 3,
    levelNotes: [
      'アーケードの入口ができる。',
      'のぼりと看板が増える。',
      '明かりのともる、にぎやかな商店街。',
    ],
    accent: '#e58a4e',
    icon: '🏬',
  },
  office: {
    type: 'office',
    name: 'ビル',
    summary: '働く人が集まる。街が都会になる。',
    buildCost: 140,
    upgradeCosts: [210, 420],
    maxLevel: 3,
    levelNotes: [
      '四階建ての小さなビル。',
      '窓の明かりが増えた中くらいのビル。',
      '屋上に看板のある高いビル。',
    ],
    accent: '#8a9bb0',
    icon: '🏢',
  },
  radioTower: {
    type: 'radioTower',
    name: '電波塔',
    summary: '街のシンボル。遠くからも見える。',
    buildCost: 200,
    upgradeCosts: [300, 600],
    maxLevel: 3,
    levelNotes: [
      '鉄骨の小さな塔。',
      '高くなり、赤と白にぬられる。',
      '展望台つきの大きな電波塔。夜は光る。',
    ],
    accent: '#e06c5a',
    icon: '🗼',
  },
};

/** 解放される順（建設画面の並び順） */
export const BUILDING_ORDER: BuildingType[] = [
  'house',
  'shop',
  'park',
  'field',
  'postOffice',
  'school',
  'station',
  'shoppingStreet',
  'office',
  'radioTower',
];

/** 土地の値段 = min(max, base + step × これまでに買った数) */
export const LAND_COST = { base: 15, step: 5, max: 60 } as const;

export interface TownStageSpec {
  /** この区画の数以上で到達 */
  at: number;
  name: string;
  /** この節目で新しく建てられるようになる建物 */
  unlocks: BuildingType[];
}

/** 街の節目（at の昇順）。区画の数で呼び名と建てられる建物が増える */
export const TOWN_STAGES: TownStageSpec[] = [
  { at: 6, name: '小さな村', unlocks: ['house', 'shop', 'park'] },
  { at: 12, name: '村', unlocks: ['field'] },
  { at: 20, name: '小さな町', unlocks: ['postOffice'] },
  { at: 30, name: '町', unlocks: ['school'] },
  { at: 45, name: 'にぎやかな町', unlocks: ['station'] },
  { at: 65, name: '市', unlocks: ['shoppingStreet'] },
  { at: 90, name: '都市', unlocks: ['office'] },
  { at: 120, name: '大都市', unlocks: ['radioTower'] },
];

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
