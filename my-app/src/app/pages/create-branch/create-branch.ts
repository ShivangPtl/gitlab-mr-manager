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
import { Badge } from "../../components/badge/badge";
import { MatIcon } from '@angular/material/icon';
import { CustomSettings } from '../settings/settings';
import { getProjectType } from '../../../shared/base';

declare const window: any;
@Component({
  selector: 'app-create-branch',
  imports: [CommonModule, FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatOptionModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatSnackBarModule,
    MatSlideToggleModule, Badge, MatIcon],
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
  customSettings?: CustomSettings;
  getProjectType = getProjectType;
  async ngOnInit() {
    this.token = (await window.electronAPI.getToken()).token;
    this.customSettings = await window.electronAPI.getSettings();
    this.loadProjects();
  }

  async loadProjects() {
    this.dataSource.data = (this.customSettings?.projects || []).filter((p : any) => p.is_selected);

    const validProjects = (this.customSettings?.projects || []).filter(
      (p: ProjectSettingModel) => p.is_selected
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

    this.dataSource.data = this.dataSource.data.map((p: any) => ({
      ...p,
      branch_status: '-',
      protection_status: '-',
      web_url: null
    }));

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
    const tasks = selected.map(async (proj) => {
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
    });

    await Promise.all(tasks);

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

    this.dataSource.data = this.dataSource.data.map((p: any) => ({
      ...p,
      branch_status: '-',
      protection_status: '-',
      web_url: null
    }));

    try {

      if (!this.newBranchName.trim()) {
      this.snackBar.open('Enter branch name!', 'Close', { duration: 3000 });
      this.loaderService.hide();
      return;
    }

      this.loaderService.showLoading('Checking branch & protection status…');

      const selected = this.dataSource.data.filter(p => p.is_selected);
      const targetList = selected.length ? selected : this.dataSource.data;

      const tasks = targetList.map(async (proj) => {

        const response = await fetch(
        `${this.baseUrl}/projects/${proj.project_id}/repository/branches/${encodeURIComponent(this.newBranchName)}`,
          {
            method: 'GET',
            headers: { 'PRIVATE-TOKEN': this.token }
          }
        );

        if (response.ok) {
          const info = await response.json();

          proj.branch_status = 'Created';

          proj.protection_status = info.protected ? 'Protected' : 'UnProtected';
          proj.web_url = info.web_url || null;
        } 
        else {
          proj.branch_status = 'Not Found';
          proj.protection_status = '-';
          proj.web_url = null;
        }

      });

      await Promise.all(tasks);

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

  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }

  get hasSelectedProject(): boolean {
    return this.customSettings?.projects?.some(p => p.is_selected) || false;
  }
}