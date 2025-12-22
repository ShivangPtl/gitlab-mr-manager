import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { UserItem } from '../../models/user-item.model';
import { LabelItem } from '../../models/label-item.model';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { Navbar } from '../../pages/navbar/navbar';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource } from '@angular/material/table';
import { LoaderService } from '../../services/loader';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ProjectListModel } from '../../models/project-list.model';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

declare const window: any;
@Component({
  selector: 'app-create-branch',
  imports: [CommonModule, FormsModule, Navbar,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatOptionModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatSnackBarModule,
    MatSlideToggleModule
  ],
  templateUrl: './create-branch.html',
  styleUrl: './create-branch.scss'
})
export class CreateBranch implements OnInit {

  baseBranch = 'master_ah';
  newBranchName = '';
  isProtected = true;

  token = '';
  displayedColumns = ['select', 'project', 'branch_status', 'protection_status'];
  dataSource = new MatTableDataSource<any>();
  baseUrl = 'https://git.promptdairytech.com/api/v4';

  constructor(private loaderService: LoaderService, private snackBar: MatSnackBar) {}
  lastRefreshed: Date | null = null;
  async ngOnInit() {
    this.token = (await window.electronAPI.getToken()).token;
    this.loadProjects();
  }

  async loadProjects() {
    const settings = await window.electronAPI.getSettings();
    this.dataSource.data = (settings.projects || []).filter((p : any) => p.is_selected);

    const validProjects = (settings.projects || []).filter(
      (p: ProjectSettingModel) => p.is_selected && p.local_repo_path
    );
    
    this.dataSource.data = validProjects.map((p : any) => ({
      ...p,
      is_selected: false,
      branch_status: '-',
      protection_status: '-'
    }));
  }

  isAnySelected(): boolean {
    return this.dataSource.data.some(p => p.is_selected);
  }

  async createBranches() {
    if (!this.newBranchName.trim()) {
      this.snackBar.open('Enter branch name!', 'Close', { duration: 3000 });
      return;
    }

    const selected = this.dataSource.data.filter(p => p.is_selected);

    if (!selected.length) {
      this.snackBar.open('Select at least one project!', 'Close', { duration: 3000 });
      return;
    }

    this.loaderService.showLoading('Creating branches…');
    for (const proj of selected) {
      try {
        // 1️⃣ Create branch
        const createResponse = await fetch(
          `${this.baseUrl}/projects/${proj.project_id}/repository/branches`,
          {
            method: 'POST',
            headers: {
              'PRIVATE-TOKEN': this.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              branch: this.newBranchName.trim(),
              ref: this.baseBranch.trim()
            })
          }
        );

        if (createResponse.ok) {
          proj.branch_status = 'Created';
          const info = await createResponse.json();

          proj.web_url = info.web_url || null;
          proj.protection_status = info.protected ? 'Protected' : '-';
        } else if (createResponse.status === 400) {
          proj.branch_status = 'Exists';
        } else {
          proj.branch_status = 'Failed';
        }

        // 3️⃣ Protect branch
        if (this.isProtected && proj.protection_status !== 'Protected') {
          const protectResponse = await fetch(
            `${this.baseUrl}/projects/${proj.project_id}/protected_branches`,
            {
              method: 'POST',
              headers: {
                'PRIVATE-TOKEN': this.token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: this.newBranchName.trim(),
                push_access_level: 40,
                merge_access_level: 40
              })
            }
          );

          if (protectResponse.ok) {
            proj.protection_status = 'Protected';
          }
        }

      } catch (err) {
        console.error(err);
        proj.branch_status = 'Failed';
        proj.protection_status = 'Failed';
      }
    }

    // Refresh table
    this.dataSource.data = [...this.dataSource.data];
    this.lastRefreshed = new Date();

    this.loaderService.hide();

    this.snackBar.open('Branches updated ✔', 'Close', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });

  }

  async refreshBranchStatus() {
    try {

      if (!this.newBranchName.trim()) {
      this.snackBar.open('Enter branch name!', 'Close', { duration: 3000 });
      this.loaderService.hide();
      return;
    }

      this.loaderService.showLoading('Checking branch & protection status…');

      const selected = this.dataSource.data.filter(p => p.is_selected);
      const targetList = selected.length ? selected : this.dataSource.data;

      for (const proj of targetList) {

        const response = await fetch(
        `${this.baseUrl}/projects/${proj.project_id}/repository/branches/${encodeURIComponent(this.newBranchName)}`,
          {
            method: 'GET',
            headers: { 'PRIVATE-TOKEN': this.token }
          }
        );

        if (response.ok) {
          const info = await response.json();

          proj.branch_status = info.merged ? 'Merged' : 'Exists';

          proj.protection_status = info.protected ? 'Protected' : '-';
          proj.web_url = info.web_url || null;
        } 
        else {
          proj.branch_status = 'Not Found';
          proj.protection_status = '-';
          proj.web_url = null;
        }

      }

      // Refresh UI
      this.dataSource.data = [...this.dataSource.data];

      this.loaderService.hide();

      // this.snackBar.open('Branch info updated ✔', 'Close', {
      //   duration: 2000,
      //   panelClass: ['success-snackbar']
      // });

    } catch (err) {
      this.loaderService.hide();
      // this.snackBar.open('Failed to refresh status ❌', 'Close', {
      //   duration: 3000,
      //   panelClass: ['error-snackbar']
      // });
    }

    this.lastRefreshed = new Date();
  }

  getStatusClass(status: string) {
    switch ((status || '').toLowerCase()) {
      case 'exists': return 'exists';
      case 'protected': return 'protected';
      case 'created': return 'created';
      case 'merged': return 'created';
      case 'not found': return 'not-found';
      default: return '';
    }
  }

  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }

}