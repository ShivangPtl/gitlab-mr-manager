import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-update-schedule-result-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <mat-icon [class.success]="data.failed.length === 0" [class.partial]="data.failed.length > 0">
        {{ data.failed.length === 0 ? 'check_circle' : 'warning' }}
      </mat-icon>
      <h2>{{ data.failed.length === 0 ? 'Update Complete' : 'Update Finished with Errors' }}</h2>
    </div>

    <div class="dialog-body">
      <div class="branch-arrow">
        <span class="branch old">{{ data.oldBranch }}</span>
        <mat-icon>arrow_forward</mat-icon>
        <span class="branch new">{{ data.newBranch }}</span>
      </div>

      <div class="section" *ngIf="data.succeeded.length > 0">
        <div class="section-label success">
          <mat-icon>check_circle</mat-icon>
          {{ data.succeeded.length }} updated successfully
        </div>
        <div class="project-list">
          <div class="project-row" *ngFor="let name of data.succeeded">
            <mat-icon class="dot success">circle</mat-icon> {{ name }}
          </div>
        </div>
      </div>

      <div class="section" *ngIf="data.failed.length > 0">
        <div class="section-label error">
          <mat-icon>error</mat-icon>
          {{ data.failed.length }} failed
        </div>
        <div class="project-list">
          <div class="project-row error-row" *ngFor="let f of data.failed">
            <mat-icon class="dot error">circle</mat-icon>
            <div>
              <span class="project-name">{{ f.project }}</span>
              <span class="error-reason">{{ f.reason }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section" *ngIf="data.skipped.length > 0">
        <div class="section-label warn">
          <mat-icon>info</mat-icon>
          {{ data.skipped.length }} skipped — branch "{{ data.newBranch }}" not found
        </div>
        <div class="project-list">
          <div class="project-row muted" *ngFor="let name of data.skipped">
            <mat-icon class="dot warn">circle</mat-icon> {{ name }}
          </div>
        </div>
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-raised-button class="themed-btn secondary" (click)="dialogRef.close()">Done</button>
    </div>
  `,
  styles: [`

  @import '../../../../assets/shared-styles.scss';

    .dialog-header {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 1.25rem 1.5rem 0;
      h2 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
      mat-icon { font-size: 22px; width: 22px; height: 22px;
        &.success { color: #4ade80; }
        &.partial { color: #fbbf24; }
      }
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
      font-family: 'Roboto Mono', monospace; font-size: 0.9rem;
      font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 4px;
    }
    .branch.old { background: rgba(239,68,68,0.12); color: #f87171; }
    .branch.new { background: rgba(34,197,94,0.12); color: #4ade80; }
    .section { display: flex; flex-direction: column; gap: 0.4rem; }
    .section-label {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.82rem; font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.success { color: #4ade80; }
      &.error { color: #f87171; }
      &.warn { color: #fbbf24; }
    }
    .project-list { display: flex; flex-direction: column; gap: 0.2rem; padding-left: 0.5rem; }
    .project-row {
      display: flex; 
      align-items: flex-start; 
      gap: 0.4rem;
      font-size: 0.82rem; 
      color: var(--text-primary);
      &.muted { color: var(--text-tertiary); }
      &.error-row { flex-direction: row; align-items: flex-start; }
    }
    .dot { font-size: 8px; width: 8px; height: 8px; margin-top: 4px;
      &.success { color: #4ade80; }
      &.error { color: #f87171; }
      &.warn { color: #fbbf24; }
    }
    .project-name { display: block; font-weight: 500; }
    .error-reason {
      display: block; font-size: 0.75rem;
      color: #f87171; margin-top: 0.1rem;
    }
    .dialog-actions {
      display: flex; justify-content: flex-end;
      padding: 0.75rem 1.5rem 1.25rem;
      border-top: 1px solid var(--border-color);
    }
  `]
})
export class UpdateScheduleResultDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UpdateScheduleResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      oldBranch: string;
      newBranch: string;
      succeeded: string[];
      failed: { project: string; reason: string }[];
      skipped: string[];
    }
  ) {}
}