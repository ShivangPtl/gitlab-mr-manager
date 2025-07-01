import { Component, OnInit } from '@angular/core';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { UserItem } from '../../models/user-item.model';
import { LabelItem } from '../../models/label-item.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../navbar/navbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

declare const window: any;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatButtonModule,
    MatSlideToggleModule
  ]
})
export class Settings implements OnInit {
  projects: ProjectSettingModel[] = [];
  assignees: UserItem[] = [];
  reviewers: UserItem[] = [];
  defaultBranch = 'master_ah';
  selectedAssigneeId = 119;
  selectedReviewerId = 119;
  darkMode = true;

  ngOnInit() {
    const defaultProjects = [
      { project_id: 880, project_name: 'ah.management', local_repo_path: '', is_selected: false },
      { project_id: 24, project_name: 'Org.Management', local_repo_path: '', is_selected: false },
      { project_id: 14, project_name: 'Config.Management', local_repo_path: '', is_selected: false },
      { project_id: 19, project_name: 'Config.Identity', local_repo_path: '', is_selected: false },
      { project_id: 28, project_name: 'Common', local_repo_path: '', is_selected: false },
      { project_id: 925, project_name: 'AmulOrgAPI', local_repo_path: '', is_selected: false },
      { project_id: 897, project_name: 'Ah.Service', local_repo_path: '', is_selected: false },
      { project_id: 31, project_name: 'Org.UI', local_repo_path: '', is_selected: false },
      { project_id: 30, project_name: 'Config.UI', local_repo_path: '', is_selected: false }
    ];

    const userList: UserItem[] = [
      { user_id: 119, user_name: 'Shivang Patel' },
      { user_id: 120, user_name: 'Kiran Gami' },
      { user_id: 106, user_name: 'Ekta Gupta' },
      { user_id: 148, user_name: 'Jigisha Patel' }
    ];

    this.projects = defaultProjects;
    this.assignees = userList;
    this.reviewers = userList;

    window.electronAPI.getSettings().then((data: any) => {
      if (data.projects) this.projects = data.projects;
      if (data.defaultBranch) this.defaultBranch = data.defaultBranch;
      if (data.selectedAssigneeId) this.selectedAssigneeId = data.selectedAssigneeId;
      if (data.selectedReviewerId) this.selectedReviewerId = data.selectedReviewerId;
      if (data.darkMode !== undefined) this.darkMode = data.darkMode;

      this.applyTheme();
    });
  }

  async browseFolder(project: ProjectSettingModel) {
    const path = await window.electronAPI.openFolderDialog();
    if (path) project.local_repo_path = path;
  }

  async save() {
    const settings = {
      projects: this.projects,
      defaultBranch: this.defaultBranch,
      selectedAssigneeId: this.selectedAssigneeId,
      selectedReviewerId: this.selectedReviewerId,
      darkMode: this.darkMode
    };
    await window.electronAPI.saveSettings(settings);
    alert('Settings saved successfully!');
    this.applyTheme();
  }

  applyTheme() {
    const classList = document.body.classList;
    if (this.darkMode) {
      classList.add('dark-theme');
      classList.remove('light-theme');
    } else {
      classList.add('light-theme');
      classList.remove('dark-theme');
    }
  }
}
