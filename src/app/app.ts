import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatToolbar } from '@angular/material/toolbar';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Board } from './components/board/board';
import { GameHeader } from './components/game-header/game-header';
import { PrestigeDialog } from './components/prestige-dialog/prestige-dialog';
import { SettingsDialog } from './components/settings-dialog/settings-dialog';
import { UpgradesDialog } from './components/upgrades-dialog/upgrades-dialog';
import { CurrencyStore } from './services/currency-store';
import { GameStore } from './services/game-store';
import { KeybindingsStore } from './services/keybindings-store';
import { PrestigeStore } from './services/prestige-store';
import { UpgradesStore } from './services/upgrades-store';

@Component({
  selector: 'ms-root',
  imports: [
    MatToolbar,
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatSlideToggle,
    Board,
    GameHeader,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(GameStore);
  private readonly dialog = inject(MatDialog);
  private readonly keybindings = inject(KeybindingsStore);

  protected readonly currency = inject(CurrencyStore);
  protected readonly prestige = inject(PrestigeStore);
  protected readonly upgrades = inject(UpgradesStore);
  protected readonly status = this.store.status;

  protected readonly keyHint = computed(
    () =>
      `Tab to a square, then ${this.keybindings.revealKey().toUpperCase()} to reveal, ` +
      `${this.keybindings.flagKey().toUpperCase()} to flag, or ` +
      `${this.keybindings.snifferKey().toUpperCase()} to place a sniffer (🐶).`,
  );

  protected openSettings(): void {
    this.dialog.open(SettingsDialog);
  }

  protected openUpgrades(): void {
    this.dialog.open(UpgradesDialog);
  }

  protected openPrestige(): void {
    this.dialog.open(PrestigeDialog);
  }

  protected reset(): void {
    this.store.newGame();
  }

  protected onAutoFlagToggle(event: MatSlideToggleChange): void {
    this.upgrades.setAutoFlagEnabled(event.checked);
  }

  protected readonly banner = computed(() => {
    switch (this.status()) {
      case 'won':
        return { icon: 'celebration', text: 'Board cleared. Nicely done. Click to play again.' };
      case 'lost':
        return {
          icon: 'sentiment_very_dissatisfied',
          text: 'Boom. Click to try again.',
        };
      default:
        return null;
    }
  });
}
