import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';

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

const AUTO_FLAG_SPEED_BASE_COST = 20;
const AUTO_FLAG_SPEED_COST_GROWTH = 1.25;

interface StoredUpgrades {
  readonly mineCapacity: number;
  readonly boardRows?: number;
  readonly boardCols?: number;
  readonly boardSize?: number;
  readonly snifferSpeed?: number;
  readonly autoChordSpeed?: number;
  readonly autoRestartSpeed?: number;
  readonly autoFlagSpeed?: number;
}

interface LoadedUpgrades {
  readonly mineCapacity: number;
  readonly boardRows: number;
  readonly boardCols: number;
  readonly snifferSpeed: number;
  readonly autoChordSpeed: number;
  readonly autoRestartSpeed: number;
  readonly autoFlagSpeed: number;
}

/** Meta-progression: upgrades bought with banked mines that persist between games. */
@Injectable({ providedIn: 'root' })
export class UpgradesStore {
  private readonly currency = inject(CurrencyStore);

  private readonly stored = this.load();
  private readonly _mineCapacityLevel = signal(this.stored.mineCapacity);
  private readonly _boardRowsLevel = signal(this.stored.boardRows);
  private readonly _boardColsLevel = signal(this.stored.boardCols);
  private readonly _snifferSpeedLevel = signal(this.stored.snifferSpeed);
  private readonly _autoChordSpeedLevel = signal(this.stored.autoChordSpeed);
  private readonly _autoRestartSpeedLevel = signal(this.stored.autoRestartSpeed);
  private readonly _autoFlagSpeedLevel = signal(this.stored.autoFlagSpeed);

  readonly mineCapacityLevel = this._mineCapacityLevel.asReadonly();
  readonly boardRowsLevel = this._boardRowsLevel.asReadonly();
  readonly boardColsLevel = this._boardColsLevel.asReadonly();
  readonly snifferSpeedLevel = this._snifferSpeedLevel.asReadonly();
  readonly autoChordSpeedLevel = this._autoChordSpeedLevel.asReadonly();
  readonly autoRestartSpeedLevel = this._autoRestartSpeedLevel.asReadonly();
  readonly autoFlagSpeedLevel = this._autoFlagSpeedLevel.asReadonly();

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

  /** How long the sniffer, auto-chord, auto-restart, and auto-flag timers take once armed. */
  readonly snifferIntervalMs = computed(() => timerIntervalMs(this._snifferSpeedLevel()));
  readonly autoChordIntervalMs = computed(() => timerIntervalMs(this._autoChordSpeedLevel()));
  readonly autoRestartIntervalMs = computed(() => timerIntervalMs(this._autoRestartSpeedLevel()));
  readonly autoFlagIntervalMs = computed(() => timerIntervalMs(this._autoFlagSpeedLevel()));

  readonly isSnifferSpeedMaxed = computed(() => this.snifferIntervalMs() <= MIN_TIMER_MS);
  readonly isAutoChordSpeedMaxed = computed(() => this.autoChordIntervalMs() <= MIN_TIMER_MS);
  readonly isAutoRestartSpeedMaxed = computed(() => this.autoRestartIntervalMs() <= MIN_TIMER_MS);
  readonly isAutoFlagSpeedMaxed = computed(() => this.autoFlagIntervalMs() <= MIN_TIMER_MS);

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
  readonly autoFlagSpeedCost = computed(() =>
    Math.round(AUTO_FLAG_SPEED_BASE_COST * AUTO_FLAG_SPEED_COST_GROWTH ** this._autoFlagSpeedLevel()),
  );

  readonly canAffordMineCapacity = computed(
    () => !this.isMineCapacityMaxed() && this.currency.mines() >= this.mineCapacityCost(),
  );
  readonly canAffordBoardRows = computed(() => this.currency.mines() >= this.boardRowsCost());
  readonly canAffordBoardCols = computed(() => this.currency.mines() >= this.boardColsCost());
  readonly canAffordSnifferSpeed = computed(
    () => !this.isSnifferSpeedMaxed() && this.currency.mines() >= this.snifferSpeedCost(),
  );
  readonly canAffordAutoChordSpeed = computed(
    () => !this.isAutoChordSpeedMaxed() && this.currency.mines() >= this.autoChordSpeedCost(),
  );
  readonly canAffordAutoRestartSpeed = computed(
    () => !this.isAutoRestartSpeedMaxed() && this.currency.mines() >= this.autoRestartSpeedCost(),
  );
  readonly canAffordAutoFlagSpeed = computed(
    () => !this.isAutoFlagSpeedMaxed() && this.currency.mines() >= this.autoFlagSpeedCost(),
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

  /** Spends the current cost and speeds up the sniffer timer, if affordable. */
  buySnifferSpeed(): void {
    if (this.isSnifferSpeedMaxed() || !this.currency.spend(this.snifferSpeedCost())) {
      return;
    }
    this._snifferSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the auto-chord timer, if affordable. */
  buyAutoChordSpeed(): void {
    if (this.isAutoChordSpeedMaxed() || !this.currency.spend(this.autoChordSpeedCost())) {
      return;
    }
    this._autoChordSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the auto-restart timer, if affordable. */
  buyAutoRestartSpeed(): void {
    if (this.isAutoRestartSpeedMaxed() || !this.currency.spend(this.autoRestartSpeedCost())) {
      return;
    }
    this._autoRestartSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and speeds up the auto-flag timer, if affordable. */
  buyAutoFlagSpeed(): void {
    if (this.isAutoFlagSpeedMaxed() || !this.currency.spend(this.autoFlagSpeedCost())) {
      return;
    }
    this._autoFlagSpeedLevel.update((value) => value + 1);
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
      autoFlagSpeed: this._autoFlagSpeedLevel(),
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
      autoFlagSpeed: 0,
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
      const autoFlagSpeed = Number(parsed.autoFlagSpeed);

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
        autoFlagSpeed: Number.isFinite(autoFlagSpeed) && autoFlagSpeed >= 0 ? autoFlagSpeed : 0,
      };
    } catch {
      return empty;
    }
  }
}
