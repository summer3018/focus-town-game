/** 画面の配線。状態の変更はすべて GameStore 経由で行う。 */
import { audio } from '../core/audio';
import { buildCost, buildingCount, canBuild, townLevel, townTitle, upgradeCost } from '../core/buildings';
import { BUILDINGS, BUILDING_ORDER, CUSTOM_MINUTES, FOCUS_PRESETS, LOG_LIMIT, ONBOARDING_STEPS } from '../core/config';
import { downloadJson } from '../core/analytics';
import { rewardForMinutes } from '../core/rewards';
import { GameStore } from '../core/state';
import { clampMinutes, formatClock, formatDuration, formatTotalDuration, minutesToMs, timerView } from '../core/timer';
import type { BuildingType, SurveyAnswer } from '../core/types';
import type { CellKey } from '../core/grid';
import { canBuyLand, isUnlocked, landPrice, townStage } from '../core/land';
import { createGestureTracker } from '../render/gestures';
import { TownRenderer } from '../render/town';
import { drawBuildingPreview } from '../render/sprites';
import { rankFor } from '../core/minigameLogic';
import { ScreenRouter, onAction, qs, role, setText, toast } from './dom';
import type { ScreenName } from './dom';
import { MinigameView } from './minigameView';

const ARC_LENGTH = 553;

export class App {
  private store: GameStore;
  private router: ScreenRouter;
  private town: TownRenderer;
  private titleTown: TownRenderer;
  private minigame: MinigameView;
  private selectedMinutes = FOCUS_PRESETS[0] as number;
  private tickHandle = 0;
  private tutorialIndex = 0;
  private surveyDraft: SurveyAnswer = {
    fun: 0,
    reuse: null,
    prefer: null,
    usability: 0,
    comment: '',
    answeredAt: 0,
  };
  private lastStarValue = 0;

  constructor(store: GameStore) {
    this.store = store;
    this.router = new ScreenRouter((next, prev) => this.onScreenChange(next, prev));
    this.town = new TownRenderer(qs<HTMLCanvasElement>('#townCanvas'), () => this.store.save);
    this.titleTown = new TownRenderer(qs<HTMLCanvasElement>('#titleCanvas'), () => this.store.save, { interactive: false });
    this.minigame = new MinigameView(qs<HTMLCanvasElement>('#mgCanvas'), {
      onTick: (sec, score, combo) => {
        setText('mg-time', sec);
        setText('mg-score', score);
        setText('mg-combo', combo);
      },
      onFanfare: (combo) => this.showFanfare(combo),
      onFinish: (score, combo) => this.finishMinigame(score, combo),
    });
  }

  // ---------------- 起動 ----------------

  start(): void {
    this.store.recordStartup();
    audio.setEnabled(this.store.save.settings.soundOn);
    audio.setVolume(this.store.save.settings.volume);
    this.lastStarValue = this.store.save.stars;

    this.buildPresetButtons();
    this.buildSurveyControls();
    this.bindActions();
    this.bindTownTaps();
    this.bindSettings();
    this.bindCustomInput();

    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.tick();
    });
    // 最初のタップで音を使えるようにする（自動再生制限への対応）
    const unlock = () => audio.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });

    this.store.subscribe(() => this.renderCommon());
    this.renderCommon();
    this.titleTown.start();

    this.restoreSession();
    this.tickHandle = window.setInterval(() => this.tick(), 250);
  }

  /** 再読み込み・ブラウザを閉じたあとの復帰 */
  private restoreSession(): void {
    const session = this.store.save.session;
    const sub = role('title-sub');

    if (!session) {
      if (this.store.save.focusCount > 0) {
        sub.textContent =
          'これまでの集中：' + this.store.save.focusCount + '回 / ' + formatTotalDuration(this.store.save.totalFocusMs);
      }
      return;
    }

    const now = Date.now();
    if (now >= session.endsAt) {
      // 集中は終わっている。報酬を確定させて完了画面から再開する。
      const reward = this.store.completeFocusIfDue(now);
      if (reward) {
        this.showComplete(reward.stars, reward.plannedMinutes);
      } else {
        this.router.go('home');
      }
      return;
    }
    sub.textContent = '集中の途中です。つづきを表示します。';
    this.router.go('focus-timer');
    this.renderTimer();
  }

  // ---------------- 共通の描画 ----------------

  private renderCommon(): void {
    const save = this.store.save;
    setText('star-count', save.stars);
    setText('sheet-stars', save.stars);
    setText('town-title', townTitle(save));
    const count = buildingCount(save);
    role('town-sub').textContent = '区画 ' + save.land.length + '・建物 ' + count;

    const hint = role('home-hint');
    const hasEmpty = count < save.land.length;
    const cheapest = Math.min(
      ...townStage(save.land.length).unlocked.map((type) => buildCost(type)),
    );
    const nextLand = landPrice(save.landPurchases);
    if (hasEmpty && save.stars >= cheapest) {
      hint.textContent = '光っている区画をタップすると建てられます。';
    } else if (save.stars >= nextLand) {
      hint.textContent = '街のまわりの売地をタップすると、街を広げられます。';
    } else if (count === 0) {
      hint.textContent = 'まずは5分の集中から。' + cheapest + '★で最初の建物が建ちます。';
    } else {
      hint.textContent = '次の土地まであと ' + (nextLand - save.stars) + '★';
    }

    if (save.stars !== this.lastStarValue) {
      const chip = role('star-chip');
      chip.classList.remove('is-bump');
      void chip.offsetWidth;
      chip.classList.add('is-bump');
      this.lastStarValue = save.stars;
    }
  }

  private handleResize(): void {
    this.town.resize();
    this.titleTown.resize();
    this.minigame.resize();
  }

  private onScreenChange(next: ScreenName, prev: ScreenName): void {
    if (next === 'home') {
      this.town.resize();
      this.town.start();
    } else {
      this.town.stop();
    }

    if (next === 'title') this.titleTown.start();
    else this.titleTown.stop();

    if (prev === 'minigame' && next !== 'minigame') this.minigame.stop();

    if (next === 'records') this.renderRecords();
    if (next === 'settings') this.renderSettings();
    if (next === 'focus-setup') this.renderSetup();
    if (next === 'focus-timer') this.renderTimer();
  }

  // ---------------- 集中時間の設定 ----------------

  private buildPresetButtons(): void {
    const list = role('preset-list');
    list.innerHTML = '';
    for (const minutes of FOCUS_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset__item';
      btn.dataset.minutes = String(minutes);
      const badge = minutes === 5 ? '<span class="preset__badge">おすすめ</span>' : '';
      btn.innerHTML =
        '<strong>' + minutes + '</strong><small>分 ／ ' + rewardForMinutes(minutes) + '★</small>' + badge;
      btn.addEventListener('click', () => {
        audio.play('tap');
        this.selectedMinutes = minutes;
        this.renderSetup();
      });
      list.appendChild(btn);
    }
  }

  private bindCustomInput(): void {
    const input = qs<HTMLInputElement>('#customMinutes');
    input.addEventListener('change', () => {
      input.value = String(clampMinutes(Number(input.value), CUSTOM_MINUTES.min, CUSTOM_MINUTES.max));
    });
  }

  private renderSetup(): void {
    const minutes = this.selectedMinutes;
    setText('setup-minutes', minutes + '分');
    setText('setup-reward', rewardForMinutes(minutes));
    setText('setup-endtime', formatClock(Date.now() + minutesToMs(minutes)));
    for (const el of document.querySelectorAll<HTMLElement>('.preset__item')) {
      el.classList.toggle('is-selected', Number(el.dataset.minutes) === minutes);
    }
  }

  // ---------------- タイマー ----------------

  private tick(): void {
    if (this.router.current === 'focus-timer') {
      this.renderTimer();
    }
    if (this.router.current === 'focus-setup') {
      setText('setup-endtime', formatClock(Date.now() + minutesToMs(this.selectedMinutes)));
    }

    const session = this.store.save.session;
    if (session && Date.now() >= session.endsAt) {
      const reward = this.store.completeFocusIfDue();
      if (reward) {
        audio.play('focusComplete');
        this.showComplete(reward.stars, reward.plannedMinutes);
      }
    }
  }

  private renderTimer(): void {
    const session = this.store.save.session;
    if (!session) return;
    const view = timerView(session, Date.now());
    setText('timer-remaining', formatDuration(view.remainingMs));
    setText('timer-meta', session.plannedMinutes + '分の集中');
    setText('timer-endtime', formatClock(session.endsAt));
    setText('timer-reward', rewardForMinutes(session.plannedMinutes));
    const arc = role<HTMLElement>('timer-arc');
    arc.style.strokeDashoffset = String(Math.round(ARC_LENGTH * (1 - view.progress)));
  }

  private showComplete(stars: number, minutes: number): void {
    setText('complete-stars', '+' + stars);
    setText('complete-balance', this.store.save.stars);
    role('complete-lead').textContent = minutes + '分、集中できました。';
    this.router.go('focus-complete');
    this.town.celebrateStars(stars);
  }

  // ---------------- 街づくり ----------------

  private bindTownTaps(): void {
    const canvas = qs<HTMLCanvasElement>('#townCanvas');
    const gestures = createGestureTracker();
    const rectOf = () => canvas.getBoundingClientRect();
    const apply = (r: ReturnType<typeof gestures.move>) => {
      if (r.kind === 'pan') this.town.pan(r.dx, r.dy);
      else if (r.kind === 'pinch') {
        const rect = rectOf();
        this.town.pan(r.dx, r.dy);
        this.town.zoomAtClient(rect.left + r.cx, rect.top + r.cy, r.factor);
      } else if (r.kind === 'tap') {
        const rect = rectOf();
        this.onTownTap(rect.left + r.x, rect.top + r.y);
      }
    };
    const local = (ev: PointerEvent) => {
      const rect = rectOf();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', (ev) => {
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* 取れなくても続ける */
      }
      const p = local(ev);
      apply(gestures.down(ev.pointerId, p.x, p.y, ev.timeStamp));
    });
    canvas.addEventListener('pointermove', (ev) => {
      const p = local(ev);
      apply(gestures.move(ev.pointerId, p.x, p.y, ev.timeStamp));
    });
    canvas.addEventListener('pointerup', (ev) => {
      const p = local(ev);
      apply(gestures.up(ev.pointerId, p.x, p.y, ev.timeStamp));
    });
    canvas.addEventListener('pointercancel', (ev) => {
      apply(gestures.cancel(ev.pointerId));
    });
    canvas.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        this.town.zoomAtClient(ev.clientX, ev.clientY, Math.exp(-ev.deltaY / 400));
      },
      { passive: false },
    );
  }

  private onTownTap(clientX: number, clientY: number): void {
    if (this.town.isTapTooSmall()) {
      this.town.zoomToTap(clientX, clientY);
      return;
    }
    const cell = this.town.hitCell(clientX, clientY);
    if (cell === null) return;
    this.town.selectedCell = cell;
    audio.play('tap');
    if (this.store.save.land.includes(cell)) this.openSheet(cell);
    else this.openLandSheet(cell);
  }

  private openLandSheet(cell: CellKey): void {
    const sheet = role('build-sheet');
    const content = role('sheet-content');
    const save = this.store.save;
    const price = landPrice(save.landPurchases);
    const affordable = canBuyLand(save, cell);
    setText('sheet-title', '空き地');
    content.innerHTML = '';

    const hint = document.createElement('p');
    hint.className = 'sheet__hint';
    hint.textContent = 'この土地を買うと、街が1区画広がります。';
    content.appendChild(hint);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.disabled = !affordable;
    btn.innerHTML =
      '<span class="option__icon">🪧</span>' +
      '<span class="option__main"><span class="option__name">土地を買う</span>' +
      '<span class="option__desc">区画 ' +
      save.land.length +
      ' → ' +
      (save.land.length + 1) +
      '</span></span>' +
      '<span class="option__cost">' +
      price +
      '★<small>' +
      (affordable ? '買う' : 'あと' + Math.max(0, price - save.stars) + '★') +
      '</small></span>';
    btn.addEventListener('click', () => this.doBuyLand(cell));
    content.appendChild(btn);

    const next = townStage(save.land.length).next;
    if (next) {
      const note = document.createElement('p');
      note.className = 'sheet__hint';
      note.textContent =
        'あと ' + (next.at - save.land.length) + '区画で「' + next.name + '」になり、' +
        next.unlocks.map((t) => BUILDINGS[t].name).join('・') + 'が建てられるようになります。';
      content.appendChild(note);
    }

    sheet.hidden = false;
  }

  private doBuyLand(cell: CellKey): void {
    const r = this.store.purchaseLand(cell);
    if (!r) {
      toast('スターが足りません');
      return;
    }
    audio.play('build');
    this.closeSheet();
    this.town.markLand(cell);
    this.town.refitIfUntouched();
    if (r.stage) {
      const names = r.stage.unlocks.map((t) => BUILDINGS[t].name).join('・');
      toast('「' + r.stage.name + '」になりました！' + names + 'が建てられるようになりました');
      this.town.celebrateStars(40);
      audio.play('levelUp');
    } else {
      toast('土地が広がりました');
    }
  }

  private openSheet(cell: CellKey): void {
    const sheet = role('build-sheet');
    const content = role('sheet-content');
    const save = this.store.save;
    const existing = save.buildings[cell];
    setText('sheet-title', existing ? BUILDINGS[existing.type].name : '空いている区画');
    content.innerHTML = '';

    if (!existing) {
      const hint = document.createElement('p');
      hint.className = 'sheet__hint';
      hint.textContent = 'ここに建てるものを選んでください。';
      content.appendChild(hint);

      const nextStage = townStage(save.land.length).next;
      const lockedPreview = nextStage?.unlocks[0] ?? null;
      for (const type of BUILDING_ORDER) {
        const unlocked = isUnlocked(save, type);
        if (!unlocked && type !== lockedPreview) continue;
        const spec = BUILDINGS[type];
        if (!unlocked && nextStage) {
          const lock = document.createElement('button');
          lock.type = 'button';
          lock.className = 'option option--locked';
          lock.disabled = true;
          lock.innerHTML =
            '<span class="option__icon">🔒</span>' +
            '<span class="option__main"><span class="option__name">' +
            spec.name +
            '</span><span class="option__desc">あと ' +
            (nextStage.at - save.land.length) +
            '区画で解放</span></span>' +
            '<span class="option__cost">' +
            buildCost(type) +
            '★</span>';
          content.appendChild(lock);
          continue;
        }
        const cost = buildCost(type);
        const affordable = canBuild(save, cell, type);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option';
        btn.disabled = !affordable;
        btn.innerHTML =
          '<span class="option__icon"><canvas width="46" height="46"></canvas></span>' +
          '<span class="option__main"><span class="option__name">' +
          spec.name +
          '</span><span class="option__desc">' +
          spec.summary +
          '</span></span>' +
          '<span class="option__cost">' +
          cost +
          '★<small>' +
          (affordable ? '建てる' : 'あと' + (cost - save.stars) + '★') +
          '</small></span>';
        const preview = btn.querySelector('canvas');
        if (preview) {
          const pctx = preview.getContext('2d');
          if (pctx) drawBuildingPreview(pctx, type, 1, 46, 46, 0);
        }
        btn.addEventListener('click', () => this.doBuild(cell, type));
        content.appendChild(btn);
      }
    } else {
      const spec = BUILDINGS[existing.type];
      const next = upgradeCost(existing.type, existing.level);
      const detail = document.createElement('div');
      detail.className = 'detail';
      detail.innerHTML =
        '<div class="detail__top"><span class="option__icon"><canvas width="46" height="46"></canvas></span>' +
        '<span class="option__main"><span class="detail__name">' +
        spec.name +
        '</span><span class="detail__level">レベル ' +
        existing.level +
        ' / ' +
        spec.maxLevel +
        '</span></span></div>' +
        '<div class="levelbar">' +
        [1, 2, 3].map((i) => '<span class="' + (i <= existing.level ? 'is-on' : '') + '"></span>').join('') +
        '</div>' +
        '<p class="detail__note">' +
        spec.levelNotes[existing.level - 1] +
        '</p>';
      const preview = detail.querySelector('canvas');
      if (preview) {
        const pctx = preview.getContext('2d');
        if (pctx) drawBuildingPreview(pctx, existing.type, existing.level, 46, 46, 0);
      }
      content.appendChild(detail);

      if (next === null) {
        const done = document.createElement('p');
        done.className = 'sheet__hint';
        done.textContent = 'この建物は最大レベルです。';
        content.appendChild(done);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option';
        btn.disabled = save.stars < next;
        btn.innerHTML =
          '<span class="option__icon">⬆️</span>' +
          '<span class="option__main"><span class="option__name">レベル ' +
          (existing.level + 1) +
          ' にする</span><span class="option__desc">' +
          spec.levelNotes[existing.level] +
          '</span></span>' +
          '<span class="option__cost">' +
          next +
          '★<small>' +
          (save.stars >= next ? '強化する' : 'あと' + (next - save.stars) + '★') +
          '</small></span>';
        btn.addEventListener('click', () => this.doUpgrade(cell));
        content.appendChild(btn);
      }
    }

    sheet.hidden = false;
  }

  private closeSheet(): void {
    role('build-sheet').hidden = true;
    this.town.selectedCell = null;
  }

  private doBuild(cell: CellKey, type: BuildingType): void {
    if (!this.store.construct(cell, type)) {
      toast('スターが足りません');
      return;
    }
    audio.play('build');
    this.closeSheet();
    this.town.markBuilt(cell);
    toast(BUILDINGS[type].name + 'を建てました');
    this.maybeAskSurvey();
  }

  private doUpgrade(cell: CellKey): void {
    const before = this.store.save.buildings[cell];
    if (!before) return;
    if (!this.store.upgradeCell(cell)) {
      toast('スターが足りません');
      return;
    }
    audio.play('levelUp');
    this.closeSheet();
    this.town.markUpgraded(cell);
    const after = this.store.save.buildings[cell];
    toast(BUILDINGS[before.type].name + ' レベル' + (after?.level ?? 2) + 'に成長しました');
    this.maybeAskSurvey();
  }

  // ---------------- ミニゲーム ----------------

  private startMinigame(): void {
    this.store.startMinigame();
    this.router.go('minigame');
    const countdown = role('mg-countdown');
    countdown.hidden = false;
    let n = 3;
    countdown.textContent = String(n);
    const timer = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        countdown.hidden = true;
        window.clearInterval(timer);
      } else {
        countdown.textContent = String(n);
        audio.play('tap');
      }
    }, 700);
    setText('mg-score', 0);
    setText('mg-combo', 0);
    setText('mg-time', 60);
    this.minigame.resize();
    this.minigame.start(2100);
  }

  private showFanfare(combo: number): void {
    const el = role('mg-fanfare');
    el.textContent = combo + ' COMBO!';
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
    window.setTimeout(() => {
      el.hidden = true;
    }, 900);
  }

  private finishMinigame(score: number, combo: number): void {
    const { newBest } = this.store.finishMinigame(score, combo);
    const rank = rankFor(score);
    setText('mgr-score', score);
    setText('mgr-combo', combo);
    setText('mgr-best', this.store.save.minigameBestScore);
    setText('mgr-rank', rank.rank);
    role('mgr-message').textContent = newBest ? 'ハイスコア更新！ ' + rank.message : rank.message;
    role('mgr-rank').classList.toggle('is-great', rank.great);
    if (rank.great || newBest) audio.play('levelUp');
    else audio.play('star');
    this.router.go('minigame-result');
  }

  // ---------------- 記録 ----------------

  private renderRecords(): void {
    const save = this.store.save;
    const body = role('records-body');
    const buildings = Object.entries(save.buildings).filter(([, b]) => Boolean(b));

    const stat = (label: string, value: string) =>
      '<div class="stat"><div class="stat__label">' + label + '</div><div class="stat__value">' + value + '</div></div>';

    const rows =
      buildings.length === 0
        ? '<p class="empty">まだ建物がありません。集中してスターをためましょう。</p>'
        : '<div class="buildinglist">' +
          buildings
            .map(([, b]) => {
              const spec = BUILDINGS[b!.type];
              return (
                '<div class="buildingrow"><span>' +
                spec.icon +
                ' ' +
                spec.name +
                '</span><span class="buildingrow__lv">Lv.' +
                b!.level +
                '</span></div>'
              );
            })
            .join('') +
          '</div>';

    body.innerHTML =
      '<div class="statgrid">' +
      stat('累計の集中時間', formatTotalDuration(save.totalFocusMs)) +
      stat('集中した回数', save.focusCount + '<small>回</small>') +
      stat('いまのスター', save.stars + '<small>★</small>') +
      stat('ためた合計', save.totalEarnedStars + '<small>★</small>') +
      stat('使ったスター', save.totalSpentStars + '<small>★</small>') +
      stat('街のレベル合計', String(townLevel(save))) +
      stat('ミニゲーム最高得点', String(save.minigameBestScore)) +
      stat('遊んだ日数', save.visitDays.length + '<small>日</small>') +
      '</div>' +
      '<section class="records__section"><h3 class="records__head">街の建物</h3>' +
      rows +
      '</section>' +
      '<section class="records__section"><h3 class="records__head">市場検証用の記録</h3>' +
      '<p class="setting__note">イベント ' +
      this.store.eventCount() +
      ' 件（上限 ' +
      LOG_LIMIT +
      ' 件・古いものから消えます）。この端末の中だけに保存されています。' +
      (save.survey ? 'アンケートは回答済みです。' : 'アンケートは未回答です。') +
      '</p></section>';
  }

  private renderSettings(): void {
    const save = this.store.save;
    qs<HTMLInputElement>('[data-role="sound-toggle"]').checked = save.settings.soundOn;
    qs<HTMLInputElement>('[data-role="volume-range"]').value = String(Math.round(save.settings.volume * 100));
    role('settings-note').textContent =
      '記録はこの端末のブラウザにだけ保存されます（イベント ' +
      this.store.eventCount() +
      ' 件・上限 ' +
      LOG_LIMIT +
      ' 件）。' +
      (this.store.wasRepaired ? 'なお、前回のセーブデータに不足があったため一部を補って復旧しました。' : '');
  }

  private bindSettings(): void {
    qs<HTMLInputElement>('[data-role="sound-toggle"]').addEventListener('change', (ev) => {
      const on = (ev.target as HTMLInputElement).checked;
      this.store.setSound(on);
      audio.setEnabled(on);
      if (on) audio.play('tap');
    });
    qs<HTMLInputElement>('[data-role="volume-range"]').addEventListener('input', (ev) => {
      const v = Number((ev.target as HTMLInputElement).value) / 100;
      this.store.setVolume(v);
      audio.setVolume(v);
    });
  }

  private exportLog(): void {
    const bundle = this.store.exportBundle();
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-') +
      '_' +
      [pad(d.getHours()), pad(d.getMinutes())].join('-');
    downloadJson(bundle, 'focus-town-log_' + stamp + '.json');
    toast('JSONを書き出しました');
  }

  // ---------------- アンケート ----------------

  private buildSurveyControls(): void {
    const scale = (name: string, key: 'fun' | 'usability', low: string, high: string) => {
      const host = role(name);
      host.innerHTML = '';
      for (let i = 1; i <= 5; i += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = i + (i === 1 ? '<span>' + low + '</span>' : i === 5 ? '<span>' + high + '</span>' : '');
        btn.addEventListener('click', () => {
          this.surveyDraft[key] = i;
          for (const el of host.children) el.classList.remove('is-on');
          btn.classList.add('is-on');
          audio.play('tap');
        });
        host.appendChild(btn);
      }
    };
    scale('scale-fun', 'fun', 'いまいち', '面白い');
    scale('scale-usability', 'usability', '使いにくい', '使いやすい');

    const choice = <K extends 'reuse' | 'prefer'>(name: string, key: K, items: [string, SurveyAnswer[K]][]) => {
      const host = role(name);
      host.innerHTML = '';
      for (const [label, value] of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          this.surveyDraft[key] = value;
          for (const el of host.children) el.classList.remove('is-on');
          btn.classList.add('is-on');
          audio.play('tap');
        });
        host.appendChild(btn);
      }
    };
    choice('choice-reuse', 'reuse', [
      ['はい', 'yes'],
      ['いいえ', 'no'],
    ]);
    choice('choice-prefer', 'prefer', [
      ['街づくり', 'town'],
      ['ミニゲーム', 'minigame'],
      ['どちらも', 'both'],
      ['どちらでもない', 'neither'],
    ]);

    qs<HTMLFormElement>('[data-role="survey-form"]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const comment = qs<HTMLTextAreaElement>('[data-role="survey-comment"]').value.trim();
      this.store.saveSurvey({ ...this.surveyDraft, comment, answeredAt: Date.now() });
      role('survey-sheet').hidden = true;
      audio.play('star');
      toast('ありがとうございました');
    });
  }

  private openSurvey(): void {
    const existing = this.store.save.survey;
    if (existing) this.surveyDraft = { ...existing };
    role('survey-sheet').hidden = false;
    this.store.markSurveyPrompted();
  }

  /** 初回の集中完了、または街づくり体験のあとに一度だけ出す（任意・強制しない） */
  private maybeAskSurvey(): void {
    const save = this.store.save;
    if (save.surveyPrompted || save.survey) return;
    if (save.focusCount < 1 && buildingCount(save) < 1) return;
    window.setTimeout(() => this.openSurvey(), 1400);
  }

  // ---------------- 操作説明 ----------------

  private showTutorial(index = 0): void {
    this.tutorialIndex = index;
    const step = ONBOARDING_STEPS[index];
    if (!step) {
      role('tutorial').hidden = true;
      this.store.markOnboarded();
      return;
    }
    role('tutorial').hidden = false;
    setText('tutorial-step', index + 1 + ' / ' + ONBOARDING_STEPS.length);
    role('tutorial-title').textContent = step.title;
    role('tutorial-body').textContent = step.body;
    qs<HTMLButtonElement>('[data-action="tutorial-next"]').textContent =
      index === ONBOARDING_STEPS.length - 1 ? 'はじめる' : 'つぎへ';
  }

  // ---------------- 操作の受け口 ----------------

  private bindActions(): void {
    onAction((action) => {
      switch (action) {
        case 'title-start':
          audio.unlock();
          audio.play('tap');
          this.router.go('home');
          if (!this.store.save.onboarded) this.showTutorial(0);
          break;
        case 'back-home':
          audio.play('back');
          this.router.go('home');
          break;
        case 'go-home-build':
          audio.play('tap');
          this.router.go('home');
          this.maybeAskSurvey();
          break;
        case 'go-focus-setup':
          audio.play('tap');
          this.router.go('focus-setup');
          break;
        case 'go-records':
          audio.play('tap');
          this.router.go('records');
          break;
        case 'go-settings':
          audio.play('tap');
          this.router.go('settings');
          break;
        case 'custom-minus':
        case 'custom-plus': {
          const input = qs<HTMLInputElement>('#customMinutes');
          const delta = action === 'custom-plus' ? 1 : -1;
          input.value = String(clampMinutes(Number(input.value) + delta, CUSTOM_MINUTES.min, CUSTOM_MINUTES.max));
          audio.play('tap');
          break;
        }
        case 'use-custom': {
          const input = qs<HTMLInputElement>('#customMinutes');
          this.selectedMinutes = clampMinutes(Number(input.value), CUSTOM_MINUTES.min, CUSTOM_MINUTES.max);
          input.value = String(this.selectedMinutes);
          audio.play('tap');
          this.renderSetup();
          toast(this.selectedMinutes + '分にしました');
          break;
        }
        case 'start-focus':
          audio.play('tap');
          this.store.startFocus(this.selectedMinutes);
          this.router.go('focus-timer');
          this.renderTimer();
          break;
        case 'cancel-focus':
          audio.play('back');
          this.store.cancelFocus();
          toast('いつでも、またはじめられます');
          this.router.go('home');
          break;
        case 'go-minigame-intro':
          audio.play('tap');
          this.startMinigame();
          break;
        case 'mg-quit':
          this.minigame.stop();
          audio.play('back');
          this.router.go('home');
          break;
        case 'mg-retry':
          audio.play('tap');
          this.startMinigame();
          break;
        case 'close-sheet':
          audio.play('back');
          this.closeSheet();
          break;
        case 'open-survey':
          audio.play('tap');
          this.openSurvey();
          break;
        case 'close-survey':
          audio.play('back');
          role('survey-sheet').hidden = true;
          this.store.markSurveyPrompted();
          break;
        case 'export-log':
          audio.play('tap');
          this.exportLog();
          break;
        case 'test-sound':
          audio.unlock();
          audio.play('levelUp');
          break;
        case 'replay-tutorial':
          audio.play('tap');
          this.router.go('home');
          this.showTutorial(0);
          break;
        case 'reset-all':
          if (window.confirm('この端末に保存された記録（街・スター・ログ・アンケート）をすべて消します。よろしいですか？')) {
            this.store.resetAll();
            this.town.fitToLand();
            this.minigame.stop();
            toast('記録を消しました');
            this.router.go('title');
            this.renderCommon();
          }
          break;
        case 'tutorial-next':
          audio.play('tap');
          this.showTutorial(this.tutorialIndex + 1);
          break;
        case 'tutorial-skip':
          audio.play('back');
          role('tutorial').hidden = true;
          this.store.markOnboarded();
          break;
        default:
          break;
      }
    });
  }

  dispose(): void {
    window.clearInterval(this.tickHandle);
    this.town.stop();
    this.titleTown.stop();
    this.minigame.stop();
  }
}
