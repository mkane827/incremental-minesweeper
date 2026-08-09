import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { isChordReady } from '../../services/board.util';
import { CellComponent } from '../cell/cell';
import { DisplayStore } from '../../services/display-store';
import { GameStore } from '../../services/game-store';

@Component({
  selector: 'ms-board',
  imports: [CellComponent],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--ms-cell-size]': 'cellSizeStyle()',
  },
})
export class Board {
  private readonly store = inject(GameStore);
  private readonly display = inject(DisplayStore);

  protected readonly cells = this.store.cells;
  protected readonly locked = this.store.isOver;

  /**
   * Fixed regardless of board size - growing rows/cols never shrinks cells
   * to fit; the board just needs more scrolling instead.
   */
  protected readonly cellSizeStyle = computed(() => `${this.display.cellSize()}px`);

  protected readonly gridTemplate = computed(
    () => `repeat(${this.store.config().cols}, var(--ms-cell-size))`,
  );

  /** Indexes of revealed numbers that would trigger a chord if clicked right now. */
  protected readonly chordReady = computed(() => {
    const cells = this.cells();
    const config = this.store.config();
    const ready = new Set<number>();
    for (const cell of cells) {
      if (isChordReady(cells, cell.index, config)) {
        ready.add(cell.index);
      }
    }
    return ready;
  });

  protected onReveal(index: number): void {
    this.store.reveal(index);
  }

  protected onFlag(index: number): void {
    this.store.toggleFlag(index);
  }

  protected onChord(index: number): void {
    this.store.chord(index);
  }

  protected onSniff(index: number): void {
    this.store.toggleSniffer(index);
  }
}
