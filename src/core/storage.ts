/**
 * localStorage への保存と読み込み。
 * 壊れたデータ・足りないデータが来ても、可能な範囲で直して必ず SaveData を返す。
 */
import { BUILDINGS, MAX_CLAIMED_HISTORY, SAVE_VERSION, SLOT_IDS, STARTING_STARS, STORAGE_KEYS } from './config';
import type { BuildingType, FocusSession, PlacedBuilding, SaveData, SlotId, SurveyAnswer } from './types';

const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage が使えない環境（プライベートモード等）でも落ちないための代替 */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

export function resolveStorage(): StorageLike {
  try {
    const probe = '__focus_town_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

function num(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function todayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');
}

export function createPlayerId(rand: () => number = Math.random): string {
  // 端末内だけで使う匿名ID。個人情報・位置情報・広告IDは一切含まない。
  const part = () => Math.floor(rand() * 0xffffffff).toString(36);
  return 'p_' + part() + part();
}

export function createNewSave(now: number, rand: () => number = Math.random): SaveData {
  return {
    version: SAVE_VERSION,
    playerId: createPlayerId(rand),
    firstSeenAt: now,
    lastPlayedAt: now,
    visitDays: [todayKey(now)],
    stars: STARTING_STARS,
    totalEarnedStars: 0,
    totalSpentStars: 0,
    focusCount: 0,
    focusCancelCount: 0,
    totalFocusMs: 0,
    buildings: {},
    minigameBestScore: 0,
    minigameBestCombo: 0,
    minigamePlays: 0,
    session: null,
    claimedSessionIds: [],
    lastReward: null,
    settings: { soundOn: true, volume: 0.25 },
    onboarded: false,
    surveyPrompted: false,
    survey: null,
  };
}

function normalizeBuilding(raw: unknown, now: number): PlacedBuilding | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== 'string' || !BUILDING_TYPES.includes(type as BuildingType)) return null;
  const spec = BUILDINGS[type as BuildingType];
  return {
    type: type as BuildingType,
    level: num(o.level, 1, 1, spec.maxLevel),
    builtAt: num(o.builtAt, now),
    upgradedAt: num(o.upgradedAt, num(o.builtAt, now)),
  };
}

function normalizeSession(raw: unknown): FocusSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const startedAt = typeof o.startedAt === 'number' ? o.startedAt : NaN;
  const endsAt = typeof o.endsAt === 'number' ? o.endsAt : NaN;
  if (!id || !Number.isFinite(startedAt) || !Number.isFinite(endsAt)) return null;
  if (endsAt <= startedAt) return null;
  const plannedMs = num(o.plannedMs, endsAt - startedAt, 1);
  const status = o.status === 'completed' || o.status === 'cancelled' ? o.status : 'running';
  return {
    id,
    plannedMinutes: num(o.plannedMinutes, Math.round(plannedMs / 60000), 1, 600),
    plannedMs,
    startedAt,
    endsAt,
    status,
  };
}

function normalizeSurvey(raw: unknown): SurveyAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reuse = o.reuse === 'yes' || o.reuse === 'no' ? o.reuse : null;
  const prefer =
    o.prefer === 'town' || o.prefer === 'minigame' || o.prefer === 'both' || o.prefer === 'neither'
      ? o.prefer
      : null;
  return {
    fun: num(o.fun, 0, 0, 5),
    reuse,
    prefer,
    usability: num(o.usability, 0, 0, 5),
    comment: typeof o.comment === 'string' ? o.comment.slice(0, 1000) : '',
    answeredAt: num(o.answeredAt, 0),
  };
}

/** どんな入力でも壊れない SaveData に直す */
export function normalizeSave(raw: unknown, now: number, rand: () => number = Math.random): SaveData {
  const base = createNewSave(now, rand);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const buildings: Partial<Record<SlotId, PlacedBuilding>> = {};
  const rawBuildings = (o.buildings && typeof o.buildings === 'object' ? o.buildings : {}) as Record<string, unknown>;
  for (const slot of SLOT_IDS) {
    const b = normalizeBuilding(rawBuildings[String(slot)], now);
    if (b) buildings[slot] = b;
  }

  const claimed = Array.isArray(o.claimedSessionIds)
    ? o.claimedSessionIds.filter((v): v is string => typeof v === 'string').slice(-MAX_CLAIMED_HISTORY)
    : [];

  const visitDays = Array.isArray(o.visitDays)
    ? Array.from(new Set(o.visitDays.filter((v): v is string => typeof v === 'string'))).slice(-90)
    : base.visitDays;

  const rawSettings = (o.settings && typeof o.settings === 'object' ? o.settings : {}) as Record<string, unknown>;
  const volumeRaw = typeof rawSettings.volume === 'number' ? rawSettings.volume : base.settings.volume;

  const lastRewardRaw =
    o.lastReward && typeof o.lastReward === 'object' ? (o.lastReward as Record<string, unknown>) : null;
  const lastReward =
    lastRewardRaw && typeof lastRewardRaw.sessionId === 'string'
      ? {
          sessionId: lastRewardRaw.sessionId,
          stars: num(lastRewardRaw.stars, 0),
          plannedMinutes: num(lastRewardRaw.plannedMinutes, 0),
          actualMs: num(lastRewardRaw.actualMs, 0),
          claimedAt: num(lastRewardRaw.claimedAt, 0),
        }
      : null;

  return {
    version: SAVE_VERSION,
    playerId: str(o.playerId, base.playerId),
    firstSeenAt: num(o.firstSeenAt, now),
    lastPlayedAt: num(o.lastPlayedAt, now),
    visitDays: visitDays.length > 0 ? visitDays : base.visitDays,
    stars: num(o.stars, 0),
    totalEarnedStars: num(o.totalEarnedStars, 0),
    totalSpentStars: num(o.totalSpentStars, 0),
    focusCount: num(o.focusCount, 0),
    focusCancelCount: num(o.focusCancelCount, 0),
    totalFocusMs: num(o.totalFocusMs, 0),
    buildings,
    minigameBestScore: num(o.minigameBestScore, 0),
    minigameBestCombo: num(o.minigameBestCombo, 0),
    minigamePlays: num(o.minigamePlays, 0),
    session: normalizeSession(o.session),
    claimedSessionIds: claimed,
    lastReward,
    settings: {
      soundOn: bool(rawSettings.soundOn, base.settings.soundOn),
      volume: Math.min(1, Math.max(0, Number.isFinite(volumeRaw) ? volumeRaw : base.settings.volume)),
    },
    onboarded: bool(o.onboarded, false),
    surveyPrompted: bool(o.surveyPrompted, false),
    survey: normalizeSurvey(o.survey),
  };
}

export interface LoadResult {
  save: SaveData;
  wasRepaired: boolean;
  isNew: boolean;
}

export function loadSave(storage: StorageLike, now: number): LoadResult {
  const rawText = storage.getItem(STORAGE_KEYS.save);
  if (rawText === null) {
    return { save: createNewSave(now), wasRepaired: false, isNew: true };
  }
  try {
    const parsed = JSON.parse(rawText);
    const save = normalizeSave(parsed, now);
    const wasRepaired = JSON.stringify(parsed) !== JSON.stringify(save);
    return { save, wasRepaired, isNew: false };
  } catch {
    // 壊れていたら作り直す。元データは消さずに退避しておく。
    try {
      storage.setItem(STORAGE_KEYS.save + ':broken', rawText.slice(0, 20000));
    } catch {
      /* 退避できなくても続行する */
    }
    return { save: createNewSave(now), wasRepaired: true, isNew: true };
  }
}

export function persistSave(storage: StorageLike, save: SaveData): boolean {
  try {
    storage.setItem(STORAGE_KEYS.save, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
