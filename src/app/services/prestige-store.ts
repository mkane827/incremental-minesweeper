import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';

const STORAGE_KEY = 'ms-prestige';

/**
 * Lifetime mines earned (never reset by prestiging) needed to afford a given
 * number of prestige points, sqrt-scaled so every successive point costs
 * more than the last.
 */
const LIFETIME_MINES_PER_POINT = 2000;

export function prestigePointsForLifetimeMines(lifetimeMines: number): number {
  return Math.floor(Math.sqrt(lifetimeMines / LIFETIME_MINES_PER_POINT));
}

export const PERMANENT_SNIFFER_COST = 1;
export const PERMANENT_AUTO_FLAG_COST = 2;
export const PERMANENT_AUTO_CHORD_COST = 3;
export const PERMANENT_AUTO_RESTART_COST = 1;
export const PERMANENT_AUTO_SNIFFER_COST = 3;

interface StoredPrestige {
  readonly points: number;
  readonly lifetimePointsClaimed: number;
  readonly permanentSnifferUnlocked: boolean;
  readonly permanentAutoFlagUnlocked: boolean;
  readonly permanentAutoChordUnlocked: boolean;
  readonly permanentAutoRestartUnlocked: boolean;
  readonly permanentAutoSnifferUnlocked: boolean;
}

/**
 * Permanent meta-progression layered above `UpgradesStore`. Prestiging
 * resets the current run's spendable mines and upgrade levels in exchange
 * for prestige points, scaled off lifetime mines earned - a figure that
 * never resets, so every prestige is judged against the same ever-growing
 * total rather than a balance that could be spent down first. Anything
 * unlocked here is permanent: it stays active across every future prestige,
 * unaffected by `UpgradesStore#resetForPrestige`.
 */
@Injectable({ providedIn: 'root' })
export class PrestigeStore {
  private readonly currency = inject(CurrencyStore);

  private readonly stored = this.load();
  private readonly _points = signal(this.stored.points);
  private readonly _lifetimePointsClaimed = signal(this.stored.lifetimePointsClaimed);
  private readonly _permanentSnifferUnlocked = signal(this.stored.permanentSnifferUnlocked);
  private readonly _permanentAutoFlagUnlocked = signal(this.stored.permanentAutoFlagUnlocked);
  private readonly _permanentAutoChordUnlocked = signal(this.stored.permanentAutoChordUnlocked);
  private readonly _permanentAutoRestartUnlocked = signal(this.stored.permanentAutoRestartUnlocked);
  private readonly _permanentAutoSnifferUnlocked = signal(this.stored.permanentAutoSnifferUnlocked);

  readonly points = this._points.asReadonly();
  readonly permanentSnifferUnlocked = this._permanentSnifferUnlocked.asReadonly();
  readonly permanentAutoFlagUnlocked = this._permanentAutoFlagUnlocked.asReadonly();
  readonly permanentAutoChordUnlocked = this._permanentAutoChordUnlocked.asReadonly();
  readonly permanentAutoRestartUnlocked = this._permanentAutoRestartUnlocked.asReadonly();
  readonly permanentAutoSnifferUnlocked = this._permanentAutoSnifferUnlocked.asReadonly();

  readonly permanentSnifferCost = PERMANENT_SNIFFER_COST;
  readonly permanentAutoFlagCost = PERMANENT_AUTO_FLAG_COST;
  readonly permanentAutoChordCost = PERMANENT_AUTO_CHORD_COST;
  readonly permanentAutoRestartCost = PERMANENT_AUTO_RESTART_COST;
  readonly permanentAutoSnifferCost = PERMANENT_AUTO_SNIFFER_COST;

  /** Prestige points a claim right now would grant; 0 until enough lifetime mines have been earned since the last claim. */
  readonly availableGain = computed(() =>
    Math.max(
      0,
      prestigePointsForLifetimeMines(this.currency.lifetimeMines()) - this._lifetimePointsClaimed(),
    ),
  );
  readonly canPrestige = computed(() => this.availableGain() > 0);
  /** Lifetime mines needed to reach the next not-yet-claimed point, for progress display. */
  readonly lifetimeMinesForNextPoint = computed(
    () => LIFETIME_MINES_PER_POINT * (this._lifetimePointsClaimed() + 1) ** 2,
  );

  readonly canAffordPermanentSniffer = computed(
    () => !this._permanentSnifferUnlocked() && this._points() >= PERMANENT_SNIFFER_COST,
  );
  readonly canAffordPermanentAutoFlag = computed(
    () => !this._permanentAutoFlagUnlocked() && this._points() >= PERMANENT_AUTO_FLAG_COST,
  );
  readonly canAffordPermanentAutoChord = computed(
    () => !this._permanentAutoChordUnlocked() && this._points() >= PERMANENT_AUTO_CHORD_COST,
  );
  readonly canAffordPermanentAutoRestart = computed(
    () => !this._permanentAutoRestartUnlocked() && this._points() >= PERMANENT_AUTO_RESTART_COST,
  );
  /** Only purchasable once the permanent sniffer unlock is already owned. */
  readonly canAffordPermanentAutoSniffer = computed(
    () =>
      this._permanentSnifferUnlocked() &&
      !this._permanentAutoSnifferUnlocked() &&
      this._points() >= PERMANENT_AUTO_SNIFFER_COST,
  );

  /** Claims every currently-available prestige point. Returns the amount gained (0 if none was available). */
  claimAvailableGain(): number {
    const gain = this.availableGain();
    if (gain <= 0) {
      return 0;
    }
    this._points.update((value) => value + gain);
    this._lifetimePointsClaimed.update((value) => value + gain);
    this.persist();
    return gain;
  }

  buyPermanentSniffer(): void {
    if (this._permanentSnifferUnlocked() || this._points() < PERMANENT_SNIFFER_COST) {
      return;
    }
    this._points.update((value) => value - PERMANENT_SNIFFER_COST);
    this._permanentSnifferUnlocked.set(true);
    this.persist();
  }

  buyPermanentAutoFlag(): void {
    if (this._permanentAutoFlagUnlocked() || this._points() < PERMANENT_AUTO_FLAG_COST) {
      return;
    }
    this._points.update((value) => value - PERMANENT_AUTO_FLAG_COST);
    this._permanentAutoFlagUnlocked.set(true);
    this.persist();
  }

  buyPermanentAutoChord(): void {
    if (this._permanentAutoChordUnlocked() || this._points() < PERMANENT_AUTO_CHORD_COST) {
      return;
    }
    this._points.update((value) => value - PERMANENT_AUTO_CHORD_COST);
    this._permanentAutoChordUnlocked.set(true);
    this.persist();
  }

  buyPermanentAutoRestart(): void {
    if (this._permanentAutoRestartUnlocked() || this._points() < PERMANENT_AUTO_RESTART_COST) {
      return;
    }
    this._points.update((value) => value - PERMANENT_AUTO_RESTART_COST);
    this._permanentAutoRestartUnlocked.set(true);
    this.persist();
  }

  buyPermanentAutoSniffer(): void {
    if (
      !this._permanentSnifferUnlocked() ||
      this._permanentAutoSnifferUnlocked() ||
      this._points() < PERMANENT_AUTO_SNIFFER_COST
    ) {
      return;
    }
    this._points.update((value) => value - PERMANENT_AUTO_SNIFFER_COST);
    this._permanentAutoSnifferUnlocked.set(true);
    this.persist();
  }

  private persist(): void {
    const value: StoredPrestige = {
      points: this._points(),
      lifetimePointsClaimed: this._lifetimePointsClaimed(),
      permanentSnifferUnlocked: this._permanentSnifferUnlocked(),
      permanentAutoFlagUnlocked: this._permanentAutoFlagUnlocked(),
      permanentAutoChordUnlocked: this._permanentAutoChordUnlocked(),
      permanentAutoRestartUnlocked: this._permanentAutoRestartUnlocked(),
      permanentAutoSnifferUnlocked: this._permanentAutoSnifferUnlocked(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): StoredPrestige {
    const empty: StoredPrestige = {
      points: 0,
      lifetimePointsClaimed: 0,
      permanentSnifferUnlocked: false,
      permanentAutoFlagUnlocked: false,
      permanentAutoChordUnlocked: false,
      permanentAutoRestartUnlocked: false,
      permanentAutoSnifferUnlocked: false,
    };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return empty;
    }

    try {
      const parsed = JSON.parse(raw);
      const points = Number(parsed.points);
      const lifetimePointsClaimed = Number(parsed.lifetimePointsClaimed);
      const permanentSnifferUnlocked = parsed.permanentSnifferUnlocked === true;

      return {
        points: Number.isFinite(points) && points >= 0 ? points : 0,
        lifetimePointsClaimed:
          Number.isFinite(lifetimePointsClaimed) && lifetimePointsClaimed >= 0
            ? lifetimePointsClaimed
            : 0,
        permanentSnifferUnlocked,
        permanentAutoFlagUnlocked: parsed.permanentAutoFlagUnlocked === true,
        permanentAutoChordUnlocked: parsed.permanentAutoChordUnlocked === true,
        permanentAutoRestartUnlocked: parsed.permanentAutoRestartUnlocked === true,
        // Can never be true without the base permanent sniffer, same guard as UpgradesStore's autoSnifferUnlocked.
        permanentAutoSnifferUnlocked:
          permanentSnifferUnlocked && parsed.permanentAutoSnifferUnlocked === true,
      };
    } catch {
      return empty;
    }
  }
}
