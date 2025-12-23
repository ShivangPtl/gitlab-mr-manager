import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-config-diff-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
 template: `
    <h2 mat-dialog-title>
      Config Changes – {{ data.projectName }}
    </h2>

    <mat-dialog-content class="dialog-content">

      <div class="branch-info">
        <code>{{ data.sourceBranch }}</code>
        →
        <code>{{ data.targetBranch }}</code>
      </div>

      <div *ngFor="let item of data.diffs" class="file-block">

        <div class="file-header">
          <span class="file-name">{{ item.file }}</span>
          <span class="file-badge" *ngIf="item.newFile">NEW</span>
          <span class="file-badge deleted" *ngIf="item.deletedFile">DELETED</span>
        </div>

        <pre class="diff-view"><ng-container *ngFor="let line of splitDiff(item.diff)"><span class="diff-line" [ngClass]="getDiffClass(line)">{{ line }}</span>
        </ng-container></pre> 

      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .branch-info {
      font-family: monospace;
      margin-bottom: 12px;
      color: #666;
    }

    .file-block {
      margin-bottom: 16px;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
    }

    .file-header {
      background: #f5f5f5;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      font-weight: 600;
    }

    .file-name {
      font-family: monospace;
      font-size: 13px;
    }

    .file-badge {
      background: #ff9800;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    .file-badge.deleted {
      background: #f44336;
    }

    .diff-view {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px;
      font-size: 12px;
      overflow-x: auto;
      font-family: monospace;
      white-space: pre;
    }

    /* 👇 THIS IS IMPORTANT */
    .diff-line {
      display: inline-block;   /* 🔥 KEY FIX */
      // width: 100%;
      // white-space: pre;
      line-height: 1;        /* tight like GitLab */
      padding: 2px 6px;        /* subtle, not tall */  
    }


    /* Colors */
    .diff-add {
      color: #2da44e; /* green */
      background: rgba(46, 160, 67, 0.15);
    }

    .diff-remove {
      color: #f85149; /* red */
      background: rgba(248, 81, 73, 0.15);
    }

    .diff-context {
      color: #d4d4d4;
    }

    .diff-meta {
      color: #8b949e;
      font-style: italic;
    }

  `]
})
export class ConfigDiffDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}

  splitDiff(diff: string): string[] {
    return diff ? diff.split('\n') : [];
  }

  getDiffClass(line: string): string {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      return 'diff-meta';
    }
    if (line.startsWith('+')) {
      return 'diff-add';
    }
    if (line.startsWith('-')) {
      return 'diff-remove';
    }
    return 'diff-context';
  }

}