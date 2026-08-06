import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CellComponent } from '../cell/cell';
import { GameStore } from '../../services/game-store';

@Component({
  selector: 'ms-board',
  imports: [CellComponent],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  private readonly store = inject(GameStore);

  protected readonly cells = this.store.cells;
  protected readonly locked = this.store.isOver;

  protected readonly gridTemplate = computed(
    () => `repeat(${this.store.config().cols}, var(--ms-cell-size))`,
  );

  protected onReveal(index: number): void {
    this.store.reveal(index);
  }

  protected onFlag(index: number): void {
    this.store.toggleFlag(index);
  }

  protected onChord(index: number): void {
    this.store.chord(index);
  }
}
