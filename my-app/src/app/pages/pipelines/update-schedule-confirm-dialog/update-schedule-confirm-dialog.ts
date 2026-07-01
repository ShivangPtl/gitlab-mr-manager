import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-update-schedule-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <mat-icon>preview</mat-icon>
      <h2>Confirm Schedule Update</h2>
    </div>

    <div class="dialog-body">
      <div class="branch-arrow">
        <span class="branch old">{{ data.oldBranch }}</span>
        <mat-icon>arrow_forward</mat-icon>
        <span class="branch new">{{ data.newBranch }}</span>
      </div>

      <div class="section" *ngIf="data.canUpdate.length > 0">
        <div class="section-label success">
          <mat-icon>check_circle</mat-icon>
          {{ data.canUpdate.length }} schedule(s) will be updated
        </div>
        <div class="project-list">
          <div class="project-row" *ngFor="let item of data.canUpdate">
            <mat-icon class="dot success">circle</mat-icon>
            {{ item.projectName }}
          </div>
        </div>
      </div>

      <div class="section" *ngIf="data.branchMissing.length > 0">
        <div class="section-label warn">
          <mat-icon>warning</mat-icon>
          {{ data.branchMissing.length }} project(s) skipped — "{{ data.newBranch }}" does not exist
        </div>
        <div class="project-list">
          <div class="project-row muted" *ngFor="let item of data.branchMissing">
            <mat-icon class="dot warn">circle</mat-icon>
            {{ item.projectName }}
          </div>
        </div>
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-stroked-button class="themed-btn secondary" (click)="dialogRef.close(false)">Cancel</button>
      <button mat-raised-button class="themed-btn" (click)="dialogRef.close(true)"
        [disabled]="data.canUpdate.length === 0">
        <mat-icon>update</mat-icon> Update {{ data.canUpdate.length }} Schedule(s)
      </button>
    </div>
  `,
  styles: [`
    @import '../../../../assets/shared-styles.scss';
    .dialog-header {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 1.25rem 1.5rem 0;
      h2 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
      mat-icon { color: var(--accent-color); }
    }
    .dialog-body { padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .branch-arrow {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }
    .branch {
      font-family: 'Roboto Mono', monospace;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }
    .branch.old { background: rgba(239,68,68,0.12); color: #f87171; }
    .branch.new { background: rgba(34,197,94,0.12); color: #4ade80; }
    .section { display: flex; flex-direction: column; gap: 0.4rem; }
    .section-label {
      display: flex; align-items: center; gap: 0.4rem;
      // font-size: 0.82rem; font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.success { color: #4ade80; }
      &.warn { color: #fbbf24; }

      font-size: 0.82rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.5;
    }
    .project-list {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding-left: 0.5rem;
    }
    .project-row {
      display: flex; 
      align-items: center; 
      gap: 0.4rem;
      font-size: 0.82rem;
      color: var(--text-secondary);
      margin: 0;
      &.muted { color: var(--text-tertiary); }
    }
    .dot {
      font-size: 8px; width: 8px; height: 8px;
      &.success { color: #4ade80; }
      &.warn { color: #fbbf24; }
    }
    .dialog-actions {
      display: flex; justify-content: flex-end; gap: 0.5rem;
      padding: 0.75rem 1.5rem 1.25rem;
      border-top: 1px solid var(--border-color);
    }
  `]
})
export class UpdateScheduleConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UpdateScheduleConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      oldBranch: string;
      newBranch: string;
      canUpdate: { projectName: string }[];
      branchMissing: { projectName: string }[];
    }
  ) {}
}