import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  standalone: true,
  selector: 'app-mr-review-selection-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatCheckboxModule,
    MatButtonModule,
    FormsModule,
    MatExpansionModule
  ],
  templateUrl: './mr-review-selection-dialog.html',
  styleUrl: './mr-review-selection-dialog.scss'
})
export class MRReviewSelectionDialog implements OnInit {
  groupedFindings: any[] = [];
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<MRReviewSelectionDialog>
  ) {
    // if (this.data?.findings?.length) {

    //   const copy = [...this.data.findings];

    //   this.data.findings = [
    //     ...copy,
    //     ...copy,
    //     ...copy,
    //     ...copy,
    //     ...copy
    //   ];

    // }
  }

  ngOnInit(): void {
    const map = new Map<string, any[]>();

    this.data.findings.forEach((f: any) => {

      if (!map.has(f.file))
        map.set(f.file, []);

      map.get(f.file)!.push(f);
    });

    this.groupedFindings =
      Array.from(map.entries())
        .map(([file, findings]) => ({
          file,
          expanded: false,
          findings
        }));
  }

  confirmSelection() {
    const selected = this.data.findings.filter((x: any) => x.selected);
    this.dialogRef.close(selected);
  }

  isAnySelected() {
    return this.data.findings.filter((x: any) => x.selected).length > 0;
  }

  getDiffClass(line: string) {

    if (line.startsWith('+'))
      return 'diff-add';

    if (line.startsWith('-'))
      return 'diff-remove';

    return 'diff-context';
  }

  getFileName(path: string) {
    if (!path) return '';
    return path.split('/').pop();
  }

  formatDiffLine(line: string): string {

    if (!line) return '';

    const sign = line[0]; // + or -

    return sign + line
      .substring(1)
      .trimStart();   // 🔥 removes indentation only
  }
}