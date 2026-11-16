/** DOM まわりの小さな道具 */

export type ScreenName =
  | 'title'
  | 'home'
  | 'focus-setup'
  | 'focus-timer'
  | 'focus-complete'
  | 'minigame'
  | 'minigame-result'
  | 'records'
  | 'settings';

export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error('要素が見つかりません: ' + selector);
  return el;
}

export function role<T extends HTMLElement = HTMLElement>(name: string, root: ParentNode = document): T {
  return qs<T>('[data-role="' + name + '"]', root);
}

export function screenEl(name: ScreenName): HTMLElement {
  return qs('[data-screen="' + name + '"]');
}

export class ScreenRouter {
  current: ScreenName = 'title';
  private onChange: (next: ScreenName, prev: ScreenName) => void;

  constructor(onChange: (next: ScreenName, prev: ScreenName) => void) {
    this.onChange = onChange;
  }

  go(name: ScreenName): void {
    if (name === this.current) return;
    const prev = this.current;
    screenEl(prev).classList.remove('is-active');
    screenEl(name).classList.add('is-active');
    this.current = name;
    const main = screenEl(name);
    main.scrollTop = 0;
    this.onChange(name, prev);
  }
}

let toastTimer = 0;

export function toast(message: string, ms = 2200): void {
  const el = role('toast');
  el.textContent = message;
  el.hidden = false;
  // 連続で出たときにアニメーションをやり直す
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = '';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, ms);
}

export function setText(name: string, value: string | number): void {
  role(name).textContent = String(value);
}

/** data-action のクリックをまとめて拾う */
export function onAction(handler: (action: string, el: HTMLElement, ev: Event) => void): void {
  document.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (!action) return;
    handler(action, target, ev);
  });
}
