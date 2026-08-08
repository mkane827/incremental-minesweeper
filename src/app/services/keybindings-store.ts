import { Injectable, signal } from '@angular/core';

export const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

export type ClickAction = 'reveal' | 'flag' | 'sniff';

const DEFAULT_REVEAL_KEY = 'z';
const DEFAULT_FLAG_KEY = 'x';
const DEFAULT_SNIFFER_KEY = 'c';

const DEFAULT_PRIMARY_CLICK: ClickAction = 'reveal';
const DEFAULT_SECONDARY_CLICK: ClickAction = 'flag';

const STORAGE_KEY = 'ms-keybindings';

interface StoredKeybindings {
  readonly revealKey: string;
  readonly flagKey: string;
  readonly snifferKey?: string;
  readonly primaryClickAction?: ClickAction;
  readonly secondaryClickAction?: ClickAction;
}

/** Player-configurable shortcut letters and mouse controls. */
@Injectable({ providedIn: 'root' })
export class KeybindingsStore {
  private readonly _revealKey = signal(DEFAULT_REVEAL_KEY);
  private readonly _flagKey = signal(DEFAULT_FLAG_KEY);
  private readonly _snifferKey = signal(DEFAULT_SNIFFER_KEY);

  private readonly _primaryClickAction = signal<ClickAction>(DEFAULT_PRIMARY_CLICK);
  private readonly _secondaryClickAction = signal<ClickAction>(DEFAULT_SECONDARY_CLICK);

  readonly revealKey = this._revealKey.asReadonly();
  readonly flagKey = this._flagKey.asReadonly();
  readonly snifferKey = this._snifferKey.asReadonly();

  readonly primaryClickAction = this._primaryClickAction.asReadonly();
  readonly secondaryClickAction = this._secondaryClickAction.asReadonly();

  constructor() {
    const stored = this.load();
    if (stored) {
      if (stored.revealKey) this._revealKey.set(stored.revealKey);
      if (stored.flagKey) this._flagKey.set(stored.flagKey);
      if (stored.snifferKey) this._snifferKey.set(stored.snifferKey);
      if (stored.primaryClickAction) this._primaryClickAction.set(stored.primaryClickAction);
      if (stored.secondaryClickAction) this._secondaryClickAction.set(stored.secondaryClickAction);
    }
  }

  setRevealKey(key: string): void {
    const letter = key.toLowerCase();
    if (!LETTERS.includes(letter) || letter === this._flagKey() || letter === this._snifferKey()) {
      return;
    }
    this._revealKey.set(letter);
    this.persist();
  }

  setFlagKey(key: string): void {
    const letter = key.toLowerCase();
    if (!LETTERS.includes(letter) || letter === this._revealKey() || letter === this._snifferKey()) {
      return;
    }
    this._flagKey.set(letter);
    this.persist();
  }

  setSnifferKey(key: string): void {
    const letter = key.toLowerCase();
    if (!LETTERS.includes(letter) || letter === this._revealKey() || letter === this._flagKey()) {
      return;
    }
    this._snifferKey.set(letter);
    this.persist();
  }

  setPrimaryClickAction(action: ClickAction): void {
    this._primaryClickAction.set(action);
    this.persist();
  }

  setSecondaryClickAction(action: ClickAction): void {
    this._secondaryClickAction.set(action);
    this.persist();
  }

  private persist(): void {
    const value: StoredKeybindings = {
      revealKey: this._revealKey(),
      flagKey: this._flagKey(),
      snifferKey: this._snifferKey(),
      primaryClickAction: this._primaryClickAction(),
      secondaryClickAction: this._secondaryClickAction(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): StoredKeybindings | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      const revealKey = LETTERS.includes(parsed.revealKey) ? parsed.revealKey : DEFAULT_REVEAL_KEY;
      const flagKey = LETTERS.includes(parsed.flagKey) ? parsed.flagKey : DEFAULT_FLAG_KEY;
      const snifferKey = LETTERS.includes(parsed.snifferKey)
        ? parsed.snifferKey
        : DEFAULT_SNIFFER_KEY;

      const validActions: ClickAction[] = ['reveal', 'flag', 'sniff'];
      const primaryClickAction = validActions.includes(parsed.primaryClickAction)
        ? parsed.primaryClickAction
        : DEFAULT_PRIMARY_CLICK;
      const secondaryClickAction = validActions.includes(parsed.secondaryClickAction)
        ? parsed.secondaryClickAction
        : DEFAULT_SECONDARY_CLICK;

      if (revealKey !== flagKey && revealKey !== snifferKey && flagKey !== snifferKey) {
        return {
          revealKey,
          flagKey,
          snifferKey,
          primaryClickAction,
          secondaryClickAction,
        };
      }
    } catch {
      // Ignore malformed storage and fall back to defaults.
    }
    return null;
  }
}
