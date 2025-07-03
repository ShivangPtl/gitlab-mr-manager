import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
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

declare const window: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, Navbar,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatOptionModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatSnackBarModule
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})



export class Home implements OnInit {
  constructor(private loaderService: LoaderService, private snackBar: MatSnackBar) { }
  gitlabApiBase = 'https://git.promptdairytech.com/api/v4';
  assignees: UserItem[] = [];
  reviewers: UserItem[] = [];
  labels: LabelItem[] = [];
  selectedAssigneeId: number = 119;
  selectedReviewerId: number = 119;
  mrTitle: string = '';
  mrDescription: string = '';
  dataSource = new MatTableDataSource<ProjectListModel>();
  lastRefreshed: Date | null = null;
  token: string = '';
  loaderType: 'spinner' | 'dots' | 'pulse' | undefined = 'spinner';
  async ngOnInit() {
    this.token = (await window.electronAPI.getToken()).token;
    const settings = await window.electronAPI.getSettings();

    this.assignees = [
      { user_id: 119, user_name: 'Shivang Patel' },
      { user_id: 120, user_name: 'Kiran Gami' },
      { user_id: 106, user_name: 'Ekta Gupta' },
      { user_id: 148, user_name: 'Jigisha Patel' }
    ];

    this.reviewers = [...this.assignees];

    this.labels = [
      { name: 'Task', is_selected: false },
      { name: 'Urgent', is_selected: false },
      { name: 'High', is_selected: false },
      { name: 'Feature', is_selected: false },
      { name: 'Bug', is_selected: false },
      { name: 'User Story', is_selected: false }
    ];

    if (settings.selectedAssigneeId) this.selectedAssigneeId = settings.selectedAssigneeId;
    if (settings.selectedReviewerId) this.selectedReviewerId = settings.selectedReviewerId;
    if (settings.labels) this.labels = settings.labels;

    this.loadProjectsWithCommitInfo();
  }

  async runGit(path: string, command: string): Promise<string> {
    return await window.electronAPI.runGitCommand(path, command);
  }

  async createMergeRequests() {
    try {
      this.loaderService.showLoading('Creating MR...'); 


      const selected = this.dataSource.data.filter(p => p.is_selected);
      if (!selected.length) {
        alert('Please select at least one project.');
        this.loaderService.hide();
        return;
      }

      if (!this.token) {
        alert('Missing GitLab token.');
        this.loaderService.hide();
        return;
      }

      const selectedLabels = this.labels.filter(l => l.is_selected).map(l => l.name).join(',');
      const results: { project: string, status: 'success' | 'failed', message: string }[] = [];
      for (const proj of selected) {
        try {
          this.loaderService.showLoading(`Creating MR for ${proj.project_name}...`);
          const commitMsg = await this.runGit(proj.local_repo_path, 'log -1 --pretty=%B');

          const title = this.mrTitle?.trim() || commitMsg.split('\n')[0]?.trim() || 'Automated MR';
          const description = this.mrDescription?.trim()
            || (!commitMsg || commitMsg.length > 1000 ? 'Created from GitLabMRManager' : commitMsg.trim());

          const formData = new URLSearchParams();
          formData.append('source_branch', proj.current_branch);
          formData.append('target_branch', proj.target_branch);
          formData.append('title', title);
          formData.append('description', description);
          formData.append('assignee_id', this.selectedAssigneeId.toString());
          formData.append('reviewer_ids[]', this.selectedReviewerId.toString());
          formData.append('labels', selectedLabels);

          const response = await fetch(`https://git.promptdairytech.com/api/v4/projects/${proj.project_id}/merge_requests`, {
            method: 'POST',
            headers: {
              'PRIVATE-TOKEN': this.token,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          });

          const resText = await response.text();

          if (response.ok) {
            results.push({ project: proj.project_name, status: 'success', message: 'MR created successfully' });
          } else {
            const errorMessage = this.extractErrorMessage(resText);
            results.push({ project: proj.project_name, status: 'failed', message: errorMessage });
          }
        } catch (ex: any) {
          results.push({ project: proj.project_name, status: 'failed', message: `Exception: ${ex.message}` });
        }
        this.loaderService.hide();
      }

      await this.updateMrStatus();
      this.loaderService.hide();
      this.showMRResultsSummary(results);
    } catch (error) {
      this.loaderService.hide();
    }
  }

  async loadProjectsWithCommitInfo(): Promise<void> {
    try {
      this.loaderService.showLoading('Loading projects info...');

      const settings = await window.electronAPI.getSettings();
      const targetBranch: string = settings.defaultBranch || 'master_ah';

      const validProjects = (settings.projects || []).filter((p: ProjectSettingModel) => p.is_selected && p.local_repo_path);

      const filteredProjects: ProjectListModel[] = [];
      for (const project of validProjects) {
        this.loaderService.showLoading(`Loading ${project.project_name} info...`);
        await this.runGit(project.local_repo_path, `fetch origin ${targetBranch}:refs/remotes/origin/${targetBranch}`);

        const current_branch = await this.runGit(project.local_repo_path, 'rev-parse --abbrev-ref HEAD');
        const commits_ahead_str = await this.runGit(project.local_repo_path, `rev-list --count origin/${targetBranch}..${current_branch}`);
        const commits_ahead = parseInt(commits_ahead_str || '0');

        const mr_status = await this.fetchMRStatus(project.project_id, current_branch, targetBranch);

        filteredProjects.push({
          ...project,
          current_branch,
          target_branch: targetBranch,
          commits_ahead,
          mr_status,
          is_selected: false
        });
      }
      this.dataSource.data = [];
      this.dataSource.data = filteredProjects;
      this.lastRefreshed = new Date();
      this.loaderService.hide();
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateMrStatus(): Promise<void> {
    try {
      let selectedProjects = this.dataSource.data.filter(p => p.is_selected);
      if (selectedProjects.length === 0) {
        selectedProjects = this.dataSource.data;
      }

      if (selectedProjects.length === 0) {
        this.snackBar.open('No Projects Found!', 'Close', { duration: 3000 });
        this.loaderService.hide();
        return;
      }

      for (const project of selectedProjects) {
        const mr_status = await this.fetchMRStatus(project.project_id, project.current_branch, project.target_branch, true);
        const commits_ahead_str = await this.runGit(project.local_repo_path, `rev-list --count origin/${project.target_branch}..${project.current_branch}`);
        const commits_ahead = parseInt(commits_ahead_str || '0');
        this.dataSource.data = this.dataSource.data.map(p => p.project_id === project.project_id ? { ...p, is_selected: false, mr_status, commits_ahead } : p);
      }

      const settings = await window.electronAPI.getSettings();
      if (settings.selectedAssigneeId) this.selectedAssigneeId = settings.selectedAssigneeId;
      if (settings.selectedReviewerId) this.selectedReviewerId = settings.selectedReviewerId;
      this.labels.forEach(l => l.is_selected = false);

      this.mrTitle = '';
      this.mrDescription = '';
      this.loaderService.hide();
    } catch (error) {
      this.handleError(error);
    }
  }

  async fetchMRStatus(projectId: number, sourceBranch: string, targetBranch: string, showMessage = false): Promise<'Created' | 'Merged' | 'Rejected' | 'No MR' | 'Error'> {
    try {
      const project = this.dataSource.data.find(e => e.project_id == projectId);

      if (showMessage) {
        this.loaderService.showLoading(`Loading ${project?.project_name} info...`);
      }

      const url = `${this.gitlabApiBase}/projects/${projectId}/merge_requests?source_branch=${encodeURIComponent(sourceBranch)}&target_branch=${encodeURIComponent(targetBranch)}&state=all`;

      console.log(this.token);
      const res = await fetch(url, {
        headers: { 'PRIVATE-TOKEN': this.token }
      });

      const mrs = await res.json();

      if (!Array.isArray(mrs) || mrs.length === 0) return 'No MR';

      const latest = mrs[0]; // Assuming sorted by created date
      if (latest.state === 'merged') return 'Merged';
      if (latest.state === 'closed') return 'Rejected';
      return 'Created';
    } catch (error) {
      this.handleError(error);
      return 'Error';
    }
  }

  extractErrorMessage(responseText: string): string {
    try {
      const json = JSON.parse(responseText);
      if (typeof json.message === 'string') return json.message;
      if (typeof json.message === 'object') {
        return Object.values(json.message).flat().join(', ');
      }
    } catch {
      return responseText;
    }
    return 'Unknown error';
  }

  showMRResultsSummary(results: { project: string, status: string, message: string }[]) {
    const successes = results.filter(r => r.status === 'success');
    const errors = results.filter(r => r.status !== 'success');

    if (successes.length > 0) {
      // Prepare success message: show count + projects
      const projectsSuccess = successes.map(r => r.project).join(', ');
      const successMessage = `✅ ${successes.length} success: ${projectsSuccess}`;
      this.snackBar.open(successMessage, 'Close', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['success-snackbar']
      });
    }

    if (errors.length > 0) {
      // Prepare error message: count + projects + short messages (truncate long messages)
      const errorDetails = errors.map(r => `${r.project} (${r.message.length > 20 ? r.message.substring(0, 17) + '...' : r.message})`).join(', ');
      const errorMessage = `❌ ${errors.length} error: ${errorDetails}`;
      this.snackBar.open(errorMessage, 'Close', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['error-snackbar']
      });
    }
  }


  getMRStatusClass(status: string | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'created': return 'created';
      case 'merged': return 'merged';
      case 'rejected': return 'rejected';
      default: return 'none';
    }
  }

  isAnySelected(): boolean {
    return this.dataSource.data.some(p => p.is_selected);
  }


  handleError(error: unknown, fallbackMessage: string = 'An unexpected error occurred'): void {
    this.loaderService.hide();

    let message = fallbackMessage;

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'object' && error !== null) {
      try {
        message = JSON.stringify(error);
      } catch {
        message = fallbackMessage;
      }
    } else {
      message = String(error);
    }

    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }

}

