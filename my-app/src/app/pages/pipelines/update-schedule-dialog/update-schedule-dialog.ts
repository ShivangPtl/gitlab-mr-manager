import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-update-schedule-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="update-schedule-dialog-container">
    <div class="dialog-header">
      <mat-icon>update</mat-icon>
      <h2>Update Schedule Branches</h2>
    </div>

    <div class="dialog-body">
      <p class="dialog-desc">
        Changes the branch on all matching pipeline schedules across your selected projects.
        Only schedules whose branch <strong>exactly matches</strong> the old branch will be updated.
      </p>
      <div class="controls">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Old Branch (exact match)</mat-label>
          <input matInput [(ngModel)]="oldBranch" placeholder="e.g. 3.20.0"
            (ngModelChange)="validate()" />
          <mat-hint class="dialog-desc">Schedules with this exact branch will be updated</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="fill" class="full-width">
          <mat-label>New Branch</mat-label>
          <input matInput [(ngModel)]="newBranch" placeholder="e.g. 3.20.1"
            (ngModelChange)="validate()" />
          <mat-hint class="dialog-desc">Must exist in each project for that schedule to be updated</mat-hint>
        </mat-form-field>

        <div class="validation-error" *ngIf="validationError">
          <mat-icon>error_outline</mat-icon>
          {{ validationError }}
        </div>
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-stroked-button class="themed-btn secondary" (click)="cancel()">Cancel</button>
      <button mat-raised-button class="themed-btn"
        [disabled]="!!validationError || !oldBranch || !newBranch"
        (click)="confirm()">
        <mat-icon>search</mat-icon> Check & Preview
      </button>
    </div>
  </div>
  `,
  styles: [`

  @import '../../../../assets/shared-styles.scss';

    .update-schedule-dialog-container {
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 1.25rem 1.5rem 0;
      h2 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
      mat-icon { color: var(--accent-color); }
    }
    .dialog-body {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .dialog-desc {
      font-size: 0.82rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.5;
    }
    .full-width { width: 100%; }
    .validation-error {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.75rem;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 6px;
      font-size: 0.82rem;
      color: #f87171;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem 1.25rem;
      border-top: 1px solid var(--border-color);
    }
  `]
})
export class UpdateScheduleDialogComponent {
  oldBranch = '';
  newBranch = '';
  validationError = '';

  constructor(
    private dialogRef: MatDialogRef<UpdateScheduleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { defaultNewBranch: string }
  ) {
    this.newBranch = data.defaultNewBranch || '';
  }

  validate() {
    if (this.oldBranch && this.newBranch && this.oldBranch.trim() === this.newBranch.trim()) {
      this.validationError = 'Old and new branch cannot be the same.';
    } else {
      this.validationError = '';
    }
  }

  confirm() {
    if (this.validationError || !this.oldBranch || !this.newBranch) return;
    this.dialogRef.close({ oldBranch: this.oldBranch.trim(), newBranch: this.newBranch.trim() });
  }

  cancel() {
    this.dialogRef.close(null);
  }
}