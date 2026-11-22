import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';
import { PrestigeStore } from './prestige-store';

const STORAGE_KEY = 'ms-upgrades';

export const BASE_ROWS = 8;
export const BASE_COLS = 8;
export const BASE_MAX_MINES = 10;

/** Mine capacity can't be bought past this fraction of the board's cells. */
export const MAX_MINE_DENSITY = 0.5;

const MINE_CAPACITY_BASE_COST = 10;
const MINE_CAPACITY_COST_GROWTH = 1.15;

const BOARD_ROWS_BASE_COST = 15;
const BOARD_ROWS_COST_GROWTH = 1.2;

const BOARD_COLS_BASE_COST = 15;
const BOARD_COLS_COST_GROWTH = 1.2;

export const BASE_TIMER_MS = 10_000;
export const MIN_TIMER_MS = 200;

/**
 * Each level shaves time off a 10s timer, but the step shrinks as it goes:
 * a full second per level down to 7s, then half a second down to 5s, then a
 * quarter second down to 3s. Every level past that keeps going in fifths of
 * a second, unbounded (asymptotically - cost growth outpaces it long before
 * the hard MIN_TIMER_MS floor below ever matters).
 */
const TIMER_PHASES: ReadonlyArray<{ readonly steps: number; readonly stepMs: number }> = [
  { steps: 3, stepMs: 1000 }, // 10s -> 7s
  { steps: 4, stepMs: 500 }, // 7s -> 5s
  { steps: 8, stepMs: 250 }, // 5s -> 3s
];
const FINAL_PHASE_STEP_MS = 200; // 3s onward

export function timerIntervalMs(level: number): number {
  let ms = BASE_TIMER_MS;
  let remaining = level;

  for (const phase of TIMER_PHASES) {
    const used = Math.min(remaining, phase.steps);
    ms -= used * phase.stepMs;
    remaining -= used;
  }
  ms -= remaining * FINAL_PHASE_STEP_MS;

  return Math.max(MIN_TIMER_MS, ms);
}

const SNIFFER_SPEED_BASE_COST = 20;
const SNIFFER_SPEED_COST_GROWTH = 1.25;

const AUTO_CHORD_SPEED_BASE_COST = 20;
const AUTO_CHORD_SPEED_COST_GROWTH = 1.25;

const AUTO_RESTART_SPEED_BASE_COST = 20;
const AUTO_RESTART_SPEED_COST_GROWTH = 1.25;

/**
 * Each automation is inert until its one-time unlock is bought - the timer
 * upgrades above only matter, and only become purchasable, once the
 * matching automation is unlocked. Auto-sniffer is a further, pricier
 * unlock on top of the sniffer unlock: without it, an unmarked sniffer
 * timer just waits instead of picking a random hidden square. Auto-flag has
 * no timer/speed track of its own - it's a single unlock that flags every
 * currently-deducible mine immediately, toggleable on/off once bought.
 */
export const SNIFFER_UNLOCK_COST = 100;
export const AUTO_FLAG_UNLOCK_COST = 150;
export const AUTO_CHORD_UNLOCK_COST = 250;
export const AUTO_RESTART_UNLOCK_COST = 100;
export const AUTO_SNIFFER_UNLOCK_COST = 300;

interface StoredUpgrades {
  readonly mineCapacity: number;
  readonly boardRows?: number;
  readonly boardCols?: number;
  readonly boardSize?: number;
  readonly snifferSpeed?: number;
  readonly autoChordSpeed?: number;
  readonly autoRestartSpeed?: number;
  readonly snifferUnlocked?: boolean;
  readonly autoFlagUnlocked?: boolean;
  readonly autoFlagEnabled?: boolean;
  readonly autoChordUnlocked?: boolean;
  readonly autoRestartUnlocked?: boolean;
  readonly autoSnifferUnlocked?: boolean;
}

interface LoadedUpgrades {
  readonly mineCapacity: number;
  readonly boardRows: number;
  readonly boardCols: number;
  readonly snifferSpeed: number;
  readonly autoChordSpeed: number;
  readonly autoRestartSpeed: number;
  readonly snifferUnlocked: boolean;
  readonly autoFlagUnlocked: boolean;
  readonly autoFlagEnabled: boolean;
  readonly autoChordUnlocked: boolean;
  readonly autoRestartUnlocked: boolean;
  readonly autoSnifferUnlocked: boolean;
}

/** Meta-progression: upgrades bought with banked mines that persist between games. */
@Injectable({ providedIn: 'root' })
export class UpgradesStore {
  private readonly currency = inject(CurrencyStore);
  private readonly prestige = inject(PrestigeStore);

  private readonly stored = this.load();
  private readonly _mineCapacityLevel = signal(this.stored.mineCapacity);
  private readonly _boardRowsLevel = signal(this.stored.boardRows);
  private readonly _boardColsLevel = signal(this.stored.boardCols);
  private readonly _snifferSpeedLevel = signal(this.stored.snifferSpeed);
  private readonly _autoChordSpeedLevel = signal(this.stored.autoChordSpeed);
  private readonly _autoRestartSpeedLevel = signal(this.stored.autoRestartSpeed);
  private readonly _snifferUnlocked = signal(this.stored.snifferUnlocked);
  private readonly _autoFlagUnlocked = signal(this.stored.autoFlagUnlocked);
  private readonly _autoFlagEnabled = signal(this.stored.autoFlagEnabled);
  private readonly _autoChordUnlocked = signal(this.stored.autoChordUnlocked);
  private readonly _autoRestartUnlocked = signal(this.stored.autoRestartUnlocked);
  private readonly _autoSnifferUnlocked = signal(this.stored.autoSnifferUnlocked);

  readonly mineCapacityLevel = this._mineCapacityLevel.asReadonly();
  readonly boardRowsLevel = this._boardRowsLevel.asReadonly();
  readonly boardColsLevel = this._boardColsLevel.asReadonly();
  readonly snifferSpeedLevel = this._snifferSpeedLevel.asReadonly();
  readonly autoChordSpeedLevel = this._autoChordSpeedLevel.asReadonly();
  readonly autoRestartSpeedLevel = this._autoRestartSpeedLevel.asReadonly();
  /** Player on/off preference - only meaningful once `autoFlagUnlocked` is true. Defaults on. */
  readonly autoFlagEnabled = this._autoFlagEnabled.asReadonly();
  /** True once bought with mines OR permanently unlocked with prestige points - either way, the mechanic is live. */
  readonly snifferUnlocked = computed(
    () => this._snifferUnlocked() || this.prestige.permanentSnifferUnlocked(),
  );
  readonly autoFlagUnlocked = computed(
    () => this._autoFlagUnlocked() || this.prestige.permanentAutoFlagUnlocked(),
  );
  readonly autoChordUnlocked = computed(
    () => this._autoChordUnlocked() || this.prestige.permanentAutoChordUnlocked(),
  );
  readonly autoRestartUnlocked = computed(
    () => this._autoRestartUnlocked() || this.prestige.permanentAutoRestartUnlocked(),
  );
  readonly autoSnifferUnlocked = computed(
    () => this._autoSnifferUnlocked() || this.prestige.permanentAutoSnifferUnlocked(),
  );

  readonly snifferUnlockCost = SNIFFER_UNLOCK_COST;
  readonly autoFlagUnlockCost = AUTO_FLAG_UNLOCK_COST;
  readonly autoChordUnlockCost = AUTO_CHORD_UNLOCK_COST;
  readonly autoRestartUnlockCost = AUTO_RESTART_UNLOCK_COST;
  readonly autoSnifferUnlockCost = AUTO_SNIFFER_UNLOCK_COST;

  /** The mine count every new board is generated with. */
  readonly maxMines = computed(() => BASE_MAX_MINES + this._mineCapacityLevel());

  /** The board dimensions every new game is generated with. */
  readonly boardRows = computed(() => BASE_ROWS + this._boardRowsLevel());
  readonly boardCols = computed(() => BASE_COLS + this._boardColsLevel());

  /** Fraction of the board's cells that are currently mines. */
  readonly mineDensity = computed(() => this.maxMines() / (this.boardRows() * this.boardCols()));
  /** Mine capacity can't be bought past this many mines for the current board size. */
  readonly mineDensityCapMines = computed(() =>
    Math.floor(this.boardRows() * this.boardCols() * MAX_MINE_DENSITY),
  );
  readonly isMineCapacityMaxed = computed(() => this.maxMines() >= this.mineDensityCapMines());

  /** How long the sniffer, auto-chord, and auto-restart timers take once armed. */
  readonly snifferIntervalMs = computed(() => timerIntervalMs(this._snifferSpeedLevel()));
  readonly autoChordIntervalMs = computed(() => timerIntervalMs(this._autoChordSpeedLevel()));
  readonly autoRestartIntervalMs = computed(() => timerIntervalMs(this._autoRestartSpeedLevel()));

  readonly isSnifferSpeedMaxed = computed(() => this.snifferIntervalMs() <= MIN_TIMER_MS);
  readonly isAutoChordSpeedMaxed = computed(() => this.autoChordIntervalMs() <= MIN_TIMER_MS);
  readonly isAutoRestartSpeedMaxed = computed(() => this.autoRestartIntervalMs() <= MIN_TIMER_MS);

  readonly mineCapacityCost = computed(() =>
    Math.round(MINE_CAPACITY_BASE_COST * MINE_CAPACITY_COST_GROWTH ** this._mineCapacityLevel()),
  );
  readonly boardRowsCost = computed(() =>
    Math.round(BOARD_ROWS_BASE_COST * BOARD_ROWS_COST_GROWTH ** this._boardRowsLevel()),
  );
  readonly boardColsCost = computed(() =>
    Math.round(BOARD_COLS_BASE_COST * BOARD_COLS_COST_GROWTH ** this._boardColsLevel()),
  );
  readonly snifferSpeedCost = computed(() =>
    Math.round(SNIFFER_SPEED_BASE_COST * SNIFFER_SPEED_COST_GROWTH ** this._snifferSpeedLevel()),
  );
  readonly autoChordSpeedCost = computed(() =>
    Math.round(
      AUTO_CHORD_SPEED_BASE_COST * AUTO_CHORD_SPEED_COST_GROWTH ** this._autoChordSpeedLevel(),
    ),
  );
  readonly autoRestartSpeedCost = computed(() =>
    Math.round(
      AUTO_RESTART_SPEED_BASE_COST *
        AUTO_RESTART_SPEED_COST_GROWTH ** this._autoRestartSpeedLevel(),
    ),
  );
  readonly canAffordMineCapacity = computed(
    () => !this.isMineCapacityMaxed() && this.currency.mines() >= this.mineCapacityCost(),
  );
  readonly canAffordBoardRows = computed(() => this.currency.mines() >= this.boardRowsCost());
  readonly canAffordBoardCols = computed(() => this.currency.mines() >= this.boardColsCost());
  readonly canAffordSnifferSpeed = computed(
    () =>
      this.snifferUnlocked() &&
      !this.isSnifferSpeedMaxed() &&
      this.currency.mines() >= this.snifferSpeedCost(),
  );
  readonly canAffordAutoChordSpeed = computed(
    () =>
      this.autoChordUnlocked() &&
      !this.isAutoChordSpeedMaxed() &&
      this.currency.mines() >= this.autoChordSpeedCost(),
  );
  readonly canAffordAutoRestartSpeed = computed(
    () =>
      this.autoRestartUnlocked() &&
      !this.isAutoRestartSpeedMaxed() &&
      this.currency.mines() >= this.autoRestartSpeedCost(),
  );
  readonly canAffordSnifferUnlock = computed(
    () => !this.snifferUnlocked() && this.currency.mines() >= SNIFFER_UNLOCK_COST,
  );
  readonly canAffordAutoFlagUnlock = computed(
    () => !this.autoFlagUnlocked() && this.currency.mines() >= AUTO_FLAG_UNLOCK_COST,
  );
  readonly canAffordAutoChordUnlock = computed(
    () => !this.autoChordUnlocked() && this.currency.mines() >= AUTO_CHORD_UNLOCK_COST,
  );
  readonly canAffordAutoRestartUnlock = computed(
    () => !this.autoRestartUnlocked() && this.currency.mines() >= AUTO_RESTART_UNLOCK_COST,
  );
  /** Only purchasable once the base sniffer is already unlocked. */
  readonly canAffordAutoSnifferUnlock = computed(
    () =>
      this.snifferUnlocked() &&
      !this.autoSnifferUnlocked() &&
      this.currency.mines() >= AUTO_SNIFFER_UNLOCK_COST,
  );

  /** Spends the current cost and bumps max mines by one, unless the density cap blocks it. */
  buyMineCapacity(): void {
    if (this.isMineCapacityMaxed() || !this.currency.spend(this.mineCapacityCost())) {
      return;
    }
    this._mineCapacityLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and grows the board by one row, if affordable. */
  buyBoardRows(): void {
    if (!this.currency.spend(this.boardRowsCost())) {
      return;
    }
    this._boardRowsLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and grows the board by one column, if affordable. */
  buyBoardCols(): void {
    if (!this.currency.spend(this.boardColsCost())) {
      return;
    }
    this._boardColsLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the sniffer timer, if unlocked and affordable. */
  buySnifferSpeed(): void {
    if (
      !this.snifferUnlocked() ||
      this.isSnifferSpeedMaxed() ||
      !this.currency.spend(this.snifferSpeedCost())
    ) {
      return;
    }
    this._snifferSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the auto-chord timer, if unlocked and affordable. */
  buyAutoChordSpeed(): void {
    if (
      !this.autoChordUnlocked() ||
      this.isAutoChordSpeedMaxed() ||
      !this.currency.spend(this.autoChordSpeedCost())
    ) {
      return;
    }
    this._autoChordSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the auto-restart timer, if unlocked and affordable. */
  buyAutoRestartSpeed(): void {
    if (
      !this.autoRestartUnlocked() ||
      this.isAutoRestartSpeedMaxed() ||
      !this.currency.spend(this.autoRestartSpeedCost())
    ) {
      return;
    }
    this._autoRestartSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Turns the (already-unlocked) auto-flag mechanic on or off. */
  setAutoFlagEnabled(enabled: boolean): void {
    this._autoFlagEnabled.set(enabled);
    this.persist();
  }

  /** Unlocks the sniffer mechanic itself, if affordable. */
  buySnifferUnlock(): void {
    if (this.snifferUnlocked() || !this.currency.spend(SNIFFER_UNLOCK_COST)) {
      return;
    }
    this._snifferUnlocked.set(true);
    this.persist();
  }

  /** Unlocks the auto-flag mechanic itself, if affordable. */
  buyAutoFlagUnlock(): void {
    if (this.autoFlagUnlocked() || !this.currency.spend(AUTO_FLAG_UNLOCK_COST)) {
      return;
    }
    this._autoFlagUnlocked.set(true);
    this.persist();
  }

  /** Unlocks the auto-chord mechanic itself, if affordable. */
  buyAutoChordUnlock(): void {
    if (this.autoChordUnlocked() || !this.currency.spend(AUTO_CHORD_UNLOCK_COST)) {
      return;
    }
    this._autoChordUnlocked.set(true);
    this.persist();
  }

  /** Unlocks the auto-restart mechanic itself, if affordable. */
  buyAutoRestartUnlock(): void {
    if (this.autoRestartUnlocked() || !this.currency.spend(AUTO_RESTART_UNLOCK_COST)) {
      return;
    }
    this._autoRestartUnlocked.set(true);
    this.persist();
  }

  /** Unlocks the sniffer's random-hidden-square fallback, if the sniffer is unlocked and affordable. */
  buyAutoSnifferUnlock(): void {
    if (
      !this.snifferUnlocked() ||
      this.autoSnifferUnlocked() ||
      !this.currency.spend(AUTO_SNIFFER_UNLOCK_COST)
    ) {
      return;
    }
    this._autoSnifferUnlocked.set(true);
    this.persist();
  }

  /**
   * Prestige reset: zeroes every mine-bought level and unlock. Anything
   * unlocked permanently with prestige points stays active regardless -
   * `snifferUnlocked` etc. OR in `PrestigeStore`'s permanent flags, which
   * this never touches.
   */
  resetForPrestige(): void {
    this._mineCapacityLevel.set(0);
    this._boardRowsLevel.set(0);
    this._boardColsLevel.set(0);
    this._snifferSpeedLevel.set(0);
    this._autoChordSpeedLevel.set(0);
    this._autoRestartSpeedLevel.set(0);
    this._snifferUnlocked.set(false);
    this._autoFlagUnlocked.set(false);
    this._autoFlagEnabled.set(true);
    this._autoChordUnlocked.set(false);
    this._autoRestartUnlocked.set(false);
    this._autoSnifferUnlocked.set(false);
    this.persist();
  }

  private persist(): void {
    const value: StoredUpgrades = {
      mineCapacity: this._mineCapacityLevel(),
      boardRows: this._boardRowsLevel(),
      boardCols: this._boardColsLevel(),
      snifferSpeed: this._snifferSpeedLevel(),
      autoChordSpeed: this._autoChordSpeedLevel(),
      autoRestartSpeed: this._autoRestartSpeedLevel(),
      snifferUnlocked: this._snifferUnlocked(),
      autoFlagUnlocked: this._autoFlagUnlocked(),
      autoFlagEnabled: this._autoFlagEnabled(),
      autoChordUnlocked: this._autoChordUnlocked(),
      autoRestartUnlocked: this._autoRestartUnlocked(),
      autoSnifferUnlocked: this._autoSnifferUnlocked(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): LoadedUpgrades {
    const empty: LoadedUpgrades = {
      mineCapacity: 0,
      boardRows: 0,
      boardCols: 0,
      snifferSpeed: 0,
      autoChordSpeed: 0,
      autoRestartSpeed: 0,
      snifferUnlocked: false,
      autoFlagUnlocked: false,
      autoFlagEnabled: true,
      autoChordUnlocked: false,
      autoRestartUnlocked: false,
      autoSnifferUnlocked: false,
    };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return empty;
    }

    try {
      const parsed = JSON.parse(raw);
      const mineCapacity = Number(parsed.mineCapacity);
      let boardRows = Number(parsed.boardRows);
      let boardCols = Number(parsed.boardCols);
      const legacyBoardSize = Number(parsed.boardSize);
      const snifferSpeed = Number(parsed.snifferSpeed);
      const autoChordSpeed = Number(parsed.autoChordSpeed);
      const autoRestartSpeed = Number(parsed.autoRestartSpeed);
      const snifferUnlocked = parsed.snifferUnlocked === true;
      const autoFlagUnlocked = parsed.autoFlagUnlocked === true;
      const autoFlagEnabled = parsed.autoFlagEnabled !== false;
      const autoChordUnlocked = parsed.autoChordUnlocked === true;
      const autoRestartUnlocked = parsed.autoRestartUnlocked === true;
      const autoSnifferUnlocked = snifferUnlocked && parsed.autoSnifferUnlocked === true;

      if (!Number.isFinite(boardRows) || boardRows < 0) {
        boardRows = Number.isFinite(legacyBoardSize) && legacyBoardSize >= 0 ? legacyBoardSize : 0;
      }
      if (!Number.isFinite(boardCols) || boardCols < 0) {
        boardCols = Number.isFinite(legacyBoardSize) && legacyBoardSize >= 0 ? legacyBoardSize : 0;
      }

      return {
        mineCapacity: Number.isFinite(mineCapacity) && mineCapacity >= 0 ? mineCapacity : 0,
        boardRows,
        boardCols,
        snifferSpeed: Number.isFinite(snifferSpeed) && snifferSpeed >= 0 ? snifferSpeed : 0,
        autoChordSpeed: Number.isFinite(autoChordSpeed) && autoChordSpeed >= 0 ? autoChordSpeed : 0,
        autoRestartSpeed:
          Number.isFinite(autoRestartSpeed) && autoRestartSpeed >= 0 ? autoRestartSpeed : 0,
        snifferUnlocked,
        autoFlagUnlocked,
        autoFlagEnabled,
        autoChordUnlocked,
        autoRestartUnlocked,
        autoSnifferUnlocked,
      };
    } catch {
      return empty;
    }
  }
}
