import { Injectable, signal } from '@angular/core';

export const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

const DEFAULT_REVEAL_KEY = 'z';
const DEFAULT_FLAG_KEY = 'x';
const STORAGE_KEY = 'ms-keybindings';

interface StoredKeybindings {
  readonly revealKey: string;
  readonly flagKey: string;
}

/** Player-configurable shortcut letters for revealing and flagging the focused cell. */
@Injectable({ providedIn: 'root' })
export class KeybindingsStore {
  private readonly _revealKey = signal(DEFAULT_REVEAL_KEY);
  private readonly _flagKey = signal(DEFAULT_FLAG_KEY);

  readonly revealKey = this._revealKey.asReadonly();
  readonly flagKey = this._flagKey.asReadonly();

  constructor() {
    const stored = this.load();
    if (stored) {
      this._revealKey.set(stored.revealKey);
      this._flagKey.set(stored.flagKey);
    }
  }

  setRevealKey(key: string): void {
    const letter = key.toLowerCase();
    if (!LETTERS.includes(letter) || letter === this._flagKey()) {
      return;
    }
    this._revealKey.set(letter);
    this.persist();
  }

  setFlagKey(key: string): void {
    const letter = key.toLowerCase();
    if (!LETTERS.includes(letter) || letter === this._revealKey()) {
      return;
    }
    this._flagKey.set(letter);
    this.persist();
  }

  private persist(): void {
    const value: StoredKeybindings = { revealKey: this._revealKey(), flagKey: this._flagKey() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): StoredKeybindings | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (
        LETTERS.includes(parsed.revealKey) &&
        LETTERS.includes(parsed.flagKey) &&
        parsed.revealKey !== parsed.flagKey
      ) {
        return parsed;
      }
    } catch {
      // Ignore malformed storage and fall back to defaults.
    }
    return null;
  }
}
