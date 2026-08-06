import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ms-currency';

/** Mines banked from cleared boards — the incremental layer's currency. */
@Injectable({ providedIn: 'root' })
export class CurrencyStore {
  private readonly _mines = signal(this.load());

  readonly mines = this._mines.asReadonly();

  earn(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this._mines.update((value) => value + amount);
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

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, String(this._mines()));
  }

  private load(): number {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}
