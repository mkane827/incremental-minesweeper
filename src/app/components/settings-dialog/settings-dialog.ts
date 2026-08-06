import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { KeybindingsStore, LETTERS } from '../../services/keybindings-store';

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

  /** Every letter is offered on both selects except whichever the other action already owns. */
  protected readonly revealOptions = computed(() =>
    LETTERS.filter((letter) => letter !== this.flagKey()),
  );
  protected readonly flagOptions = computed(() =>
    LETTERS.filter((letter) => letter !== this.revealKey()),
  );

  protected onRevealChange(value: string): void {
    this.keybindings.setRevealKey(value);
  }

  protected onFlagChange(value: string): void {
    this.keybindings.setFlagKey(value);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
