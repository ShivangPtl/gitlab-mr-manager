import { Component, OnInit } from '@angular/core';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { UserItem } from '../../models/user-item.model';
import { LabelItem } from '../../models/label-item.model';
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
import { GitlabAuth } from '../../services/gitlab-auth';

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

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,    
]
})
export class Settings implements OnInit {
  constructor(private snackBar: MatSnackBar, private authService: GitlabAuth){}
  projects: ProjectSettingModel[] = [];
  assignees: UserItem[] = [];
  defaultBranch = 'master_ah';
  supportBranch = this.defaultBranch;
  releaseBranch = this.defaultBranch;
  liveBranch = this.defaultBranch;
  sourceBranch = '';
  useCustomBranch = true;
  selectedAssigneeId = 119;
  darkMode = true;

  ngOnInit() {
    const defaultProjects : ProjectSettingModel[] = [
      { project_id: 19, project_name: 'Config.Identity', local_repo_path: '', is_selected: false },
      { project_id: 14, project_name: 'Config.Management', local_repo_path: '', is_selected: false },
      { project_id: 880, project_name: 'ah.management', local_repo_path: '', is_selected: false },
      { project_id: 24, project_name: 'Org.Management', local_repo_path: '', is_selected: false },
      { project_id: 925, project_name: 'AmulOrgAPI', local_repo_path: '', is_selected: false },
      { project_id: 897, project_name: 'Ah.Service', local_repo_path: '', is_selected: false },
      { project_id: 28, project_name: 'Common', local_repo_path: '', is_selected: false },
      { project_id: 31, project_name: 'Org.UI', local_repo_path: '', is_selected: false },
      { project_id: 30, project_name: 'Config.UI', local_repo_path: '', is_selected: false },
    
      // AdoptCattle
      { project_id: 1076, project_name: 'AdoptCattle.Api', local_repo_path: '', is_selected: false },
      { project_id: 1077, project_name: 'AdoptCattle.Ui', local_repo_path: '', is_selected: false },
      { project_id: 1074, project_name: 'Common (AdoptCattle)', local_repo_path: '', is_selected: false },
      { project_id: 1075, project_name: 'Identity (AdoptCattle)', local_repo_path: '', is_selected: false }
    ];

    this.projects = defaultProjects;
    this.assignees = this.authService.userList;

    window.electronAPI.getSettings().then((data: any) => {
      if (data.projects) this.projects = data.projects;
      this.useCustomBranch = data.useCustomBranch;
      if (data.useCustomBranch) this.useCustomBranch = data.useCustomBranch;
      if (data.sourceBranch) this.sourceBranch = data.sourceBranch;
      if (data.supportBranch) this.supportBranch = data.supportBranch;
      if (data.releaseBranch) this.releaseBranch = data.releaseBranch;
      if (data.liveBranch) this.liveBranch = data.liveBranch;
      if (data.selectedAssigneeId) this.selectedAssigneeId = data.selectedAssigneeId;
      if (data.darkMode !== undefined) this.darkMode = data.darkMode;

      this.applyTheme(this.darkMode);
    });
  }

  async browseFolder(project: ProjectSettingModel) {
    const path = await window.electronAPI.openFolderDialog();
    if (path) project.local_repo_path = path;
  }

  async save(showAlert: boolean = true) {
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

    this.snackBar.open('Settings saved successfully!', 'Close', {
      duration: 2000,
      horizontalPosition: 'center',   
      verticalPosition: 'bottom',
      panelClass: ['success-snackbar']
    });

    this.applyTheme(this.darkMode);
  }


  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  onThemeToggle(event: any): void {
    this.darkMode = event.checked;
    this.applyTheme(this.darkMode);
    this.save(false);
  }
}
