import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-pipeline-details-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Pipeline Details</h2>
    <mat-dialog-content>
      <div class="details-container">
        <div class="detail-row">
          <div class="detail-key">ID</div>
          <div class="detail-value">
            {{ data.id }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Source</div>
          <div class="detail-value">
            {{ data.source }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Status</div>
          <div class="detail-value">
            <span [ngClass]="data.status.toLowerCase()">
              {{ data.status }}
            </span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Ref</div>
          <div class="detail-value">
            {{ data.ref }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Created At</div>
          <div class="detail-value">
            {{ data.createdAt }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Started At</div>
          <div class="detail-value">
            {{ data.startedAt }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Finished At</div>
          <div class="detail-value">
            {{ data.finishedAt }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Total Duration</div>
          <div class="detail-value">
            {{ data.totalDuration }}
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-key">Run Duration</div>
          <div class="detail-value">
            {{ data.runDuration }}
          </div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    /* Dialog container (entire dialog) */
    
    .dialog-header {
      background: var(--dialog-header-bg, #f5f5f5);
      margin: 0;
      padding: 16px;
      font-size: 1.25rem;
      font-weight: 600;
      border-bottom: 1px solid var(--dialog-border, #ddd);
    }
    
    .dialog-content {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .dialog-actions {
      padding: 8px 16px;
      background: var(--dialog-header-bg, #f5f5f5);
      border-top: 1px solid var(--dialog-border, #ddd);
    }
    
    /* Details Grid */
    .details-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .detail-row {
      display: flex;
      padding: 6px 0;
      border-bottom: 1px solid var(--dialog-border, #ddd);
    }
    
    .detail-key {
      flex: 1;
      font-weight: 500;
      color: var(--text-secondary, #555);
    }
    
    .detail-value {
      flex: 2;
      word-break: break-word;
      color: var(--dialog-text, #222);
      font-family: monospace;
    }
    
    /* Status Colors */
    .success {
      color: #4caf50;
      font-weight: 600;
    }
    .running {
      color: #2196f3;
      font-weight: 600;
    }
    .failed {
      color: #f44336;
      font-weight: 600;
    }
    .pending,
    .created {
      color: #ff9800;
      font-weight: 600;
    }
    .canceled {
      color: #9e9e9e;
      font-weight: 600;
    }
    
    /* Responsive enhancements */
    @media (max-width: 600px) {
      ::ng-deep .mat-dialog-container {
        margin: 8px;
      }
      .dialog-header {
        font-size: 1rem;
      }
      .detail-key {
        font-size: 0.9rem;
      }
      .detail-value {
        font-size: 0.9rem;
      }
    }
      `]
})
export class PipelineDetailsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PipelineDetails,
    private dialogRef: MatDialogRef<PipelineDetailsDialogComponent>
  ) { }

  objectKeys = Object.keys;

  isObject(val: any): boolean {
    return val && typeof val === 'object';
  }

  formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}
