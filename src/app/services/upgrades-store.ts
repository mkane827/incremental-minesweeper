import { computed, inject, Injectable, signal } from '@angular/core';
import { CurrencyStore } from './currency-store';

const STORAGE_KEY = 'ms-upgrades';

export const BASE_ROWS = 8;
export const BASE_COLS = 8;
export const BASE_MAX_MINES = 10;

const MINE_CAPACITY_BASE_COST = 10;
const MINE_CAPACITY_COST_GROWTH = 1.15;

const BOARD_ROWS_BASE_COST = 15;
const BOARD_ROWS_COST_GROWTH = 1.2;

const BOARD_COLS_BASE_COST = 15;
const BOARD_COLS_COST_GROWTH = 1.2;

export const BASE_TIMER_SECONDS = 10;
export const MIN_TIMER_SECONDS = 3;
const MAX_SPEED_LEVEL = BASE_TIMER_SECONDS - MIN_TIMER_SECONDS;

const SNIFFER_SPEED_BASE_COST = 20;
const SNIFFER_SPEED_COST_GROWTH = 1.25;

const AUTO_CHORD_SPEED_BASE_COST = 20;
const AUTO_CHORD_SPEED_COST_GROWTH = 1.25;

interface StoredUpgrades {
  readonly mineCapacity: number;
  readonly boardRows?: number;
  readonly boardCols?: number;
  readonly boardSize?: number;
  readonly snifferSpeed?: number;
  readonly autoChordSpeed?: number;
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

  readonly mineCapacityLevel = this._mineCapacityLevel.asReadonly();
  readonly boardRowsLevel = this._boardRowsLevel.asReadonly();
  readonly boardColsLevel = this._boardColsLevel.asReadonly();
  readonly snifferSpeedLevel = this._snifferSpeedLevel.asReadonly();
  readonly autoChordSpeedLevel = this._autoChordSpeedLevel.asReadonly();

  /** The mine count every new board is generated with. */
  readonly maxMines = computed(() => BASE_MAX_MINES + this._mineCapacityLevel());

  /** The board dimensions every new game is generated with. */
  readonly boardRows = computed(() => BASE_ROWS + this._boardRowsLevel());
  readonly boardCols = computed(() => BASE_COLS + this._boardColsLevel());

  /** How long the sniffer and auto-chord timers take to resolve once armed. */
  readonly snifferIntervalSeconds = computed(() =>
    Math.max(MIN_TIMER_SECONDS, BASE_TIMER_SECONDS - this._snifferSpeedLevel()),
  );
  readonly autoChordIntervalSeconds = computed(() =>
    Math.max(MIN_TIMER_SECONDS, BASE_TIMER_SECONDS - this._autoChordSpeedLevel()),
  );

  readonly isSnifferSpeedMaxed = computed(() => this._snifferSpeedLevel() >= MAX_SPEED_LEVEL);
  readonly isAutoChordSpeedMaxed = computed(() => this._autoChordSpeedLevel() >= MAX_SPEED_LEVEL);

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

  readonly canAffordMineCapacity = computed(
    () => this.currency.mines() >= this.mineCapacityCost(),
  );
  readonly canAffordBoardRows = computed(() => this.currency.mines() >= this.boardRowsCost());
  readonly canAffordBoardCols = computed(() => this.currency.mines() >= this.boardColsCost());
  readonly canAffordSnifferSpeed = computed(
    () => !this.isSnifferSpeedMaxed() && this.currency.mines() >= this.snifferSpeedCost(),
  );
  readonly canAffordAutoChordSpeed = computed(
    () => !this.isAutoChordSpeedMaxed() && this.currency.mines() >= this.autoChordSpeedCost(),
  );

  /** Spends the current cost and bumps max mines by one, if affordable. */
  buyMineCapacity(): void {
    if (!this.currency.spend(this.mineCapacityCost())) {
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

  /** Spends the current cost and shaves a second off the sniffer timer, if affordable. */
  buySnifferSpeed(): void {
    if (this.isSnifferSpeedMaxed() || !this.currency.spend(this.snifferSpeedCost())) {
      return;
    }
    this._snifferSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  /** Spends the current cost and shaves a second off the auto-chord timer, if affordable. */
  buyAutoChordSpeed(): void {
    if (this.isAutoChordSpeedMaxed() || !this.currency.spend(this.autoChordSpeedCost())) {
      return;
    }
    this._autoChordSpeedLevel.update((value) => value + 1);
    this.persist();
  }

  private persist(): void {
    const value: StoredUpgrades = {
      mineCapacity: this._mineCapacityLevel(),
      boardRows: this._boardRowsLevel(),
      boardCols: this._boardColsLevel(),
      snifferSpeed: this._snifferSpeedLevel(),
      autoChordSpeed: this._autoChordSpeedLevel(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  private load(): {
    mineCapacity: number;
    boardRows: number;
    boardCols: number;
    snifferSpeed: number;
    autoChordSpeed: number;
  } {
    const empty = { mineCapacity: 0, boardRows: 0, boardCols: 0, snifferSpeed: 0, autoChordSpeed: 0 };
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
      };
    } catch {
      return empty;
    }
  }
}
