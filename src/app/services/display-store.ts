import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ms-display';

export interface CellSizeOption {
  readonly label: string;
  readonly value: number;
}

/** Cell size in pixels - fixed regardless of board size, so a bigger board just needs more scrolling. */
export const CELL_SIZE_OPTIONS: readonly CellSizeOption[] = [
  { label: 'Small', value: 26 },
  { label: 'Medium', value: 36 },
  { label: 'Large', value: 46 },
  { label: 'Extra large', value: 58 },
];

export const DEFAULT_CELL_SIZE = 36;

/** Player-configurable display preferences. */
@Injectable({ providedIn: 'root' })
export class DisplayStore {
  private readonly _cellSize = signal(this.load());

  readonly cellSize = this._cellSize.asReadonly();

  setCellSize(size: number): void {
    if (!CELL_SIZE_OPTIONS.some((option) => option.value === size)) {
      return;
    }
    this._cellSize.set(size);
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, String(this._cellSize()));
  }

  private load(): number {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return CELL_SIZE_OPTIONS.some((option) => option.value === parsed) ? parsed : DEFAULT_CELL_SIZE;
  }
}
