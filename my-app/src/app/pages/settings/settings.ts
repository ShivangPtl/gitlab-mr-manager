import { Component, OnInit } from '@angular/core';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { UserItem } from '../../models/user-item.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { GitlabAuth } from '../../services/gitlab-auth';
import { Theme } from '../../services/theme';

declare const window: any;

export interface CustomSettings {
  projects: ProjectSettingModel[];
  useCustomBranch: boolean;
  sourceBranch: string;
  supportBranch: string;
  releaseBranch: string;
  liveBranch: string;
  selectedAssigneeId: number;
  darkMode: boolean;
}

// Default project list — single source of truth.
// To add a project: add it here and re-save settings once.
export const DEFAULT_PROJECTS: ProjectSettingModel[] = [
  { project_id: 19,   project_name: 'Config.Identity',      local_repo_path: '', is_selected: false },
  { project_id: 14,   project_name: 'Config.Management',    local_repo_path: '', is_selected: false },
  { project_id: 880,  project_name: 'ah.management',        local_repo_path: '', is_selected: false },
  { project_id: 24,   project_name: 'Org.Management',       local_repo_path: '', is_selected: false },
  { project_id: 925,  project_name: 'AmulOrgAPI',           local_repo_path: '', is_selected: false },
  { project_id: 897,  project_name: 'Ah.Service',           local_repo_path: '', is_selected: false },
  { project_id: 28,   project_name: 'Common',               local_repo_path: '', is_selected: false },
  { project_id: 31,   project_name: 'Org.UI',               local_repo_path: '', is_selected: false },
  { project_id: 30,   project_name: 'Config.UI',            local_repo_path: '', is_selected: false },
  { project_id: 1076, project_name: 'AdoptCattle.Api',      local_repo_path: '', is_selected: false },
  { project_id: 1077, project_name: 'AdoptCattle.Ui',       local_repo_path: '', is_selected: false },
  { project_id: 1074, project_name: 'Common (AdoptCattle)', local_repo_path: '', is_selected: false },
  { project_id: 1075, project_name: 'Identity (AdoptCattle)',local_repo_path: '', is_selected: false },
];

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatTableModule, MatButtonModule,
    MatSlideToggleModule, MatIconModule, MatSnackBarModule,
  ]
})
export class Settings implements OnInit {
  projects: ProjectSettingModel[] = [];
  assignees: UserItem[] = [];
  supportBranch = 'master_ah';
  releaseBranch = 'master_ah';
  liveBranch = 'master_ah';
  sourceBranch = '';
  useCustomBranch = true;
  selectedAssigneeId = 119;
  darkMode = true;

  constructor(
    private snackBar: MatSnackBar,
    private authService: GitlabAuth,
    private themeService: Theme
  ) {}

  async ngOnInit() {
    this.assignees = this.authService.userList;

    const data: Partial<CustomSettings> = await window.electronAPI.getSettings() ?? {};

    // Merge saved projects onto the default list so new projects appear automatically
    // but saved selections / paths are preserved.
    const savedMap = new Map((data.projects ?? []).map(p => [p.project_id, p]));
    this.projects = DEFAULT_PROJECTS.map(def => savedMap.get(def.project_id) ?? def);

    this.useCustomBranch   = data.useCustomBranch   ?? true;
    this.sourceBranch      = data.sourceBranch      ?? '';
    this.supportBranch     = data.supportBranch     ?? 'master_ah';
    this.releaseBranch     = data.releaseBranch     ?? 'master_ah';
    this.liveBranch        = data.liveBranch        ?? 'master_ah';
    this.selectedAssigneeId= data.selectedAssigneeId ?? 119;
    this.darkMode          = data.darkMode          ?? true;

    this.themeService.apply(this.darkMode);
  }

  async browseFolder(project: ProjectSettingModel) {
    const path = await window.electronAPI.openFolderDialog();
    if (path) project.local_repo_path = path;
  }

  async save(showToast = true) {
    const settings: CustomSettings = {
      projects: this.projects,
      useCustomBranch: this.useCustomBranch,
      sourceBranch: this.sourceBranch,
      supportBranch: this.supportBranch,
      releaseBranch: this.releaseBranch,
      liveBranch: this.liveBranch,
      selectedAssigneeId: this.selectedAssigneeId,
      darkMode: this.darkMode,
    };

    await window.electronAPI.saveSettings(settings);
    this.themeService.apply(this.darkMode);

    if (showToast) {
      this.snackBar.open('Settings saved', 'Close', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['success-snackbar']
      });
    }
  }

  onThemeToggle(event: any): void {
    this.darkMode = event.checked;
    this.save(false);
  }
}