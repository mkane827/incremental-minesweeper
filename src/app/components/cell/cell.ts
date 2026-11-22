import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Cell } from '../../models/cell';
import { KeybindingsStore } from '../../services/keybindings-store';

@Component({
  selector: 'ms-cell',
  imports: [MatIcon],
  templateUrl: './cell.html',
  styleUrl: './cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'gridcell',
    tabindex: '0',
    '[class.is-revealed]': 'cell().state === "revealed"',
    '[class.is-flagged]': 'cell().state === "flagged"',
    '[class.is-auto-flagged]': 'cell().autoFlagged',
    '[class.is-exploded]': 'cell().exploded',
    '[class.is-wrong]': 'cell().wrongFlag',
    '[class.is-chord-ready]': 'chordReady()',
    '[attr.data-count]': 'countAttr()',
    '[attr.aria-label]': 'ariaLabel()',
    '(click)': 'onPrimary()',
    '(contextmenu)': 'onSecondary($event)',
    '(keydown)': 'onKeydown($event)',
    '(mouseenter)': 'onHoverEnter()',
  },
})
export class CellComponent {
  private readonly keybindings = inject(KeybindingsStore);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly cell = input.required<Cell>();
  readonly locked = input(false);
  readonly chordReady = input(false);

  readonly reveal = output<void>();
  readonly flag = output<void>();
  readonly chord = output<void>();
  readonly sniff = output<void>();

  /** Drives the per-number colours in SCSS via an attribute selector. */
  protected readonly countAttr = computed(() => {
    const cell = this.cell();
    if (cell.state !== 'revealed' || cell.isMine || cell.adjacentMines === 0) {
      return null;
    }
    return String(cell.adjacentMines);
  });

  protected readonly ariaLabel = computed(() => {
    const cell = this.cell();
    const position = `row ${cell.row + 1}, column ${cell.col + 1}`;

    switch (cell.state) {
      case 'flagged':
        return cell.autoFlagged ? `Auto-flagged, ${position}` : `Flagged, ${position}`;
      case 'hidden':
        return cell.hasSniffer ? `Sniffer placed, ${position}` : `Hidden, ${position}`;
      default:
        if (cell.isMine) {
          return `Mine, ${position}`;
        }
        return cell.adjacentMines === 0
          ? `Empty, ${position}`
          : `${cell.adjacentMines} adjacent mines, ${position}`;
    }
  });

  protected onPrimary(): void {
    if (this.locked()) {
      return;
    }
    this.executeAction(this.keybindings.primaryClickAction());
  }

  protected onSecondary(event: Event): void {
    event.preventDefault();
    if (this.locked()) {
      return;
    }
    this.executeAction(this.keybindings.secondaryClickAction());
  }

  private executeAction(action: 'reveal' | 'flag' | 'sniff'): void {
    const cell = this.cell();
    switch (action) {
      case 'reveal':
        if (cell.state === 'revealed') {
          this.chord.emit();
        } else if (cell.state === 'hidden') {
          this.reveal.emit();
        }
        break;
      case 'flag':
        if (cell.state !== 'revealed') {
          this.flag.emit();
        }
        break;
      case 'sniff':
        if (cell.state === 'hidden') {
          this.sniff.emit();
        }
        break;
    }
  }

  /** Hovering a cell arms it for the reveal/flag keyboard shortcuts. */
  protected onHoverEnter(): void {
    this.elementRef.nativeElement.focus({ preventScroll: true });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.onPrimary();
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      this.onSecondary(event);
      return;
    }

    const letter = event.key.toLowerCase();
    if (letter === this.keybindings.revealKey()) {
      event.preventDefault();
      this.executeAction('reveal');
    } else if (letter === this.keybindings.flagKey()) {
      event.preventDefault();
      this.executeAction('flag');
    } else if (letter === this.keybindings.snifferKey()) {
      event.preventDefault();
      this.executeAction('sniff');
    }
  }
}
