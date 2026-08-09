import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ms-currency';

interface StoredCurrency {
  readonly mines: number;
  readonly lifetimeMines: number;
}

/** Mines banked from cleared boards — the incremental layer's currency. */
@Injectable({ providedIn: 'root' })
export class CurrencyStore {
  private readonly stored = this.load();
  private readonly _mines = signal(this.stored.mines);
  /** Total mines ever earned. Never decreases, not even on a prestige reset - it's what prestige gain is measured against. */
  private readonly _lifetimeMines = signal(this.stored.lifetimeMines);

  readonly mines = this._mines.asReadonly();
  readonly lifetimeMines = this._lifetimeMines.asReadonly();

  earn(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this._mines.update((value) => value + amount);
    this._lifetimeMines.update((value) => value + amount);
    this.persist();
  }

  /** Attempts to spend `amount`; returns whether the balance covered it. */
  spend(amount: number): boolean {
    if (amount <= 0 || this._mines() < amount) {
      return false;
    }
    this._mines.update((value) => value - amount);
    this.persist();
    return true;
  }

  /** Prestige reset: zeroes the spendable balance. Lifetime earnings are untouched. */
  resetSpendable(): void {
    this._mines.set(0);
    this.persist();
  }

  private persist(): void {
    const value: StoredCurrency = { mines: this._mines(), lifetimeMines: this._lifetimeMines() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): StoredCurrency {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { mines: 0, lifetimeMines: 0 };
    }

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'number') {
        // Legacy format: a bare mines balance, from before lifetime tracking existed.
        const mines = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        return { mines, lifetimeMines: mines };
      }
      const mines = Number(parsed?.mines);
      const lifetimeMines = Number(parsed?.lifetimeMines);
      return {
        mines: Number.isFinite(mines) && mines >= 0 ? mines : 0,
        lifetimeMines: Number.isFinite(lifetimeMines) && lifetimeMines >= 0 ? lifetimeMines : 0,
      };
    } catch {
      return { mines: 0, lifetimeMines: 0 };
    }
  }
}
