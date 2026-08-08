import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { ClickAction, KeybindingsStore, LETTERS } from '../../services/keybindings-store';

@Component({
  selector: 'ms-settings-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialog {
  private readonly keybindings = inject(KeybindingsStore);
  private readonly dialogRef = inject(MatDialogRef<SettingsDialog>);

  protected readonly revealKey = this.keybindings.revealKey;
  protected readonly flagKey = this.keybindings.flagKey;
  protected readonly snifferKey = this.keybindings.snifferKey;

  protected readonly primaryClickAction = this.keybindings.primaryClickAction;
  protected readonly secondaryClickAction = this.keybindings.secondaryClickAction;

  protected readonly clickOptions: { label: string; value: ClickAction }[] = [
    { label: 'Reveal / Chord', value: 'reveal' },
    { label: 'Toggle Flag', value: 'flag' },
    { label: 'Place Sniffer (🐶)', value: 'sniff' },
  ];

  protected readonly revealOptions = computed(() =>
    LETTERS.filter((l) => l !== this.flagKey() && l !== this.snifferKey()),
  );
  protected readonly flagOptions = computed(() =>
    LETTERS.filter((l) => l !== this.revealKey() && l !== this.snifferKey()),
  );
  protected readonly snifferOptions = computed(() =>
    LETTERS.filter((l) => l !== this.revealKey() && l !== this.flagKey()),
  );

  protected onRevealChange(value: string): void {
    this.keybindings.setRevealKey(value);
  }

  protected onFlagChange(value: string): void {
    this.keybindings.setFlagKey(value);
  }

  protected onSnifferChange(value: string): void {
    this.keybindings.setSnifferKey(value);
  }

  protected onPrimaryClickChange(value: ClickAction): void {
    this.keybindings.setPrimaryClickAction(value);
  }

  protected onSecondaryClickChange(value: ClickAction): void {
    this.keybindings.setSecondaryClickAction(value);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
