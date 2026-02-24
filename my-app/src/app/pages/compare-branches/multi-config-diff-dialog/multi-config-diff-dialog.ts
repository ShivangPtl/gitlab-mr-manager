import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

@Component({
  standalone: true,
  selector: 'app-multi-config-diff-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
 
 <h2 mat-dialog-title>
  AI Review - Config Changes
 </h2>
 
 <mat-dialog-content>
 
 <div *ngFor="let project of data.projects">
 
 <h3>{{project.project_name}}</h3>
 
 <div class="file-block">

<div class="file-header">
<span class="file-name">
{{project.project_name}}.config
</span>
</div>

<div class="diff-view">

<ng-container
*ngFor="let line of splitDiff(project.ai_diff)">

<span class="diff-line"
[ngClass]="getDiffClass(line)">

<span class="diff-text">
{{line}}
</span>

<span
*ngIf="getAIComment(line,project.aiReviewComments) as ai"
class="ai-warning"
[ngClass]="ai.risk">

⚠ {{ai.comment}}

</span>

</span>

</ng-container>

</div>

</div>
 
 </div>
 
 </mat-dialog-content>
 
 <mat-dialog-actions align="end">
 <button mat-button mat-dialog-close>Close</button>
 </mat-dialog-actions>
 `,
  styleUrl: './multi-config-diff-dialog.scss'
})
export class MultiConfigDiffDialogComponent {

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: any) { }

  splitDiff(diff: string) {
    return diff ? diff.split('\n') : [];
  }

  getDiffClass(line: string) {

    if (line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('@@'))
      return 'diff-meta';

    if (line.startsWith('+'))
      return 'diff-add';

    if (line.startsWith('-'))
      return 'diff-remove';

    return 'diff-context';
  }

  getAIComment(line: string, comments: any[]) {

    if (!comments) return null;

    return comments.find(c =>
      line.includes(c.line.trim()));

  }
}