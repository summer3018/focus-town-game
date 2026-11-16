/**
 * 市場検証用のプレイログ。
 * localStorage にためて、本人がJSONでダウンロードできる。
 * 個人情報・位置情報・連絡先・広告IDは記録しない。
 */
import { LOG_LIMIT, STORAGE_KEYS } from './config';
import type { LogEvent, LogEventName, SaveData } from './types';
import type { StorageLike } from './storage';

export type LogPayload = Omit<LogEvent, 't' | 'iso' | 'name' | 'pid'>;

export function readLog(storage: StorageLike): LogEvent[] {
  const raw = storage.getItem(STORAGE_KEYS.log);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is LogEvent => Boolean(e) && typeof e === 'object' && typeof e.name === 'string');
  } catch {
    return [];
  }
}

export function writeLog(storage: StorageLike, events: LogEvent[]): boolean {
  try {
    storage.setItem(STORAGE_KEYS.log, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

/** 上限を超えたぶんを古いものから捨てる */
export function trimLog(events: LogEvent[], limit = LOG_LIMIT): LogEvent[] {
  if (events.length <= limit) return events;
  return events.slice(events.length - limit);
}

export function appendEvent(
  storage: StorageLike,
  playerId: string,
  name: LogEventName,
  payload: LogPayload = {},
  now: number = Date.now(),
): LogEvent {
  const event: LogEvent = {
    t: now,
    iso: new Date(now).toISOString(),
    name,
    pid: playerId,
    ...payload,
  };
  const events = trimLog([...readLog(storage), event]);
  writeLog(storage, events);
  return event;
}

export function clearLog(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEYS.log);
}

export interface ExportBundle {
  app: string;
  exportVersion: number;
  exportedAt: string;
  note: string;
  player: {
    id: string;
    firstSeenAt: string;
    lastPlayedAt: string;
    distinctVisitDays: number;
  };
  summary: {
    focusCount: number;
    focusCancelCount: number;
    totalFocusMinutes: number;
    starsEarned: number;
    starsSpent: number;
    starsBalance: number;
    buildings: { slot: number; type: string; level: number }[];
    minigamePlays: number;
    minigameBestScore: number;
    minigameBestCombo: number;
  };
  survey: SaveData['survey'];
  events: LogEvent[];
}

export function buildExport(save: SaveData, events: LogEvent[], now = Date.now()): ExportBundle {
  const buildings = Object.entries(save.buildings)
    .filter(([, b]) => Boolean(b))
    .map(([slot, b]) => ({ slot: Number(slot), type: b!.type, level: b!.level }));

  return {
    app: 'focus-town-game',
    exportVersion: 1,
    exportedAt: new Date(now).toISOString(),
    note: 'この端末のlocalStorageに保存された記録です。個人情報・位置情報・連絡先・広告IDは含みません。',
    player: {
      id: save.playerId,
      firstSeenAt: new Date(save.firstSeenAt).toISOString(),
      lastPlayedAt: new Date(save.lastPlayedAt).toISOString(),
      distinctVisitDays: save.visitDays.length,
    },
    summary: {
      focusCount: save.focusCount,
      focusCancelCount: save.focusCancelCount,
      totalFocusMinutes: Math.round(save.totalFocusMs / 60000),
      starsEarned: save.totalEarnedStars,
      starsSpent: save.totalSpentStars,
      starsBalance: save.stars,
      buildings,
      minigamePlays: save.minigamePlays,
      minigameBestScore: save.minigameBestScore,
      minigameBestCombo: save.minigameBestCombo,
    },
    survey: save.survey,
    events,
  };
}

/** ブラウザでJSONファイルとして保存させる */
export function downloadJson(bundle: ExportBundle, filename: string): void {
  const text = JSON.stringify(bundle, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
