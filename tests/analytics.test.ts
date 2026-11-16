import { describe, expect, it } from 'vitest';
import { appendEvent, buildExport, readLog, trimLog } from '../src/core/analytics';
import { LOG_LIMIT } from '../src/core/config';
import { createMemoryStorage, createNewSave } from '../src/core/storage';
import type { LogEvent } from '../src/core/types';

const T0 = new Date('2026-11-17T09:00:00+09:00').getTime();

describe('プレイログ', () => {
  it('イベントを追記して読み戻せる', () => {
    const storage = createMemoryStorage();
    appendEvent(storage, 'p_1', 'game_start', {}, T0);
    appendEvent(storage, 'p_1', 'focus_start', { plannedMinutes: 25 }, T0 + 10);
    const log = readLog(storage);
    expect(log.length).toBe(2);
    expect(log[1].name).toBe('focus_start');
    expect(log[1].plannedMinutes).toBe(25);
    expect(log[1].pid).toBe('p_1');
    expect(log[1].iso).toBe(new Date(T0 + 10).toISOString());
  });

  it('壊れたログは空として扱う', () => {
    const storage = createMemoryStorage();
    storage.setItem('focus-town:log:v1', 'not json');
    expect(readLog(storage)).toEqual([]);
  });

  it('上限を超えたら古いものから捨てる', () => {
    const events: LogEvent[] = Array.from({ length: LOG_LIMIT + 50 }, (_, i) => ({
      t: T0 + i,
      iso: new Date(T0 + i).toISOString(),
      name: 'game_start',
      pid: 'p_1',
    }));
    const trimmed = trimLog(events);
    expect(trimmed.length).toBe(LOG_LIMIT);
    expect(trimmed[0].t).toBe(T0 + 50);
  });

  it('追記し続けても保存件数は上限で止まる', () => {
    const storage = createMemoryStorage();
    for (let i = 0; i < LOG_LIMIT + 20; i += 1) {
      appendEvent(storage, 'p_1', 'minigame_start', {}, T0 + i);
    }
    expect(readLog(storage).length).toBe(LOG_LIMIT);
  });
});

describe('buildExport', () => {
  it('集計とイベントをまとめ、個人情報を含めない', () => {
    const save = createNewSave(T0);
    save.stars = 40;
    save.totalEarnedStars = 90;
    save.totalSpentStars = 50;
    save.focusCount = 3;
    save.totalFocusMs = 45 * 60_000;
    save.minigameBestScore = 620;
    save.buildings[0] = { type: 'house', level: 2, builtAt: T0, upgradedAt: T0 };

    const bundle = buildExport(save, [], T0);
    expect(bundle.app).toBe('focus-town-game');
    expect(bundle.summary.totalFocusMinutes).toBe(45);
    expect(bundle.summary.starsBalance).toBe(40);
    expect(bundle.summary.buildings).toEqual([{ slot: 0, type: 'house', level: 2 }]);
    expect(bundle.player.id).toBe(save.playerId);

    const text = JSON.stringify(bundle);
    expect(text).not.toMatch(/email|lat|lng|phone|address|adid/i);
  });

  it('アンケートの回答も一緒に出る', () => {
    const save = createNewSave(T0);
    save.survey = { fun: 5, reuse: 'yes', prefer: 'town', usability: 4, comment: 'いい', answeredAt: T0 };
    const bundle = buildExport(save, [], T0);
    expect(bundle.survey?.fun).toBe(5);
    expect(bundle.survey?.prefer).toBe('town');
  });
});
