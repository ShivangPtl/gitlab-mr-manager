import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
import { GitlabAuth } from '../../services/gitlab-auth';
import { CustomSettings } from '../settings/settings';
import { Badge } from "../../components/badge/badge";
import { BaseService } from '../../services/base-service';
import { MatIcon } from '@angular/material/icon';
import { getProjectType } from '../../../shared/base';
// import { LogService } from '../../services/log-service';

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
    MatSnackBarModule, Badge, MatIcon],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})



export class Home implements OnInit {
  targetBranch = 'master_ah';
  constructor(private loaderService: LoaderService, private snackBar: MatSnackBar, private authService: GitlabAuth, private cdr: ChangeDetectorRef, 
    private baseService: BaseService) 
  {
    this.targetBranch = localStorage.getItem('selectedTargetBranch') || 'master_ah';
  }
  gitlabApiBase = 'https://git.promptdairytech.com/api/v4';
  assignees: UserItem[] = [];
  labels: LabelItem[] = [];
  selectedAssigneeId: number = 119;
  mrTitle: string = '';
  mrDescription: string = '';
  dataSource = new MatTableDataSource<ProjectListModel>();
  lastRefreshed: Date | null = null;
  token: string = '';
  loaderType: 'spinner' | 'dots' | 'pulse' | undefined = 'spinner';
  customSettings?: CustomSettings;
  showBranchSelector = false;
  getProjectType = getProjectType;
  async ngOnInit() {
    this.token = (await window.electronAPI.getToken()).token;
    this.customSettings = await window.electronAPI.getSettings();

    this.assignees = this.authService.userList;

    this.labels = [
      { name: 'Task', is_selected: false },
      { name: 'Urgent', is_selected: false },
      { name: 'High', is_selected: false },
      { name: 'Feature', is_selected: false },
      { name: 'Bug', is_selected: false },
      { name: 'User Story', is_selected: false },
      { name: 'Branch Merge', is_selected: false }
    ];

    if (this.customSettings?.selectedAssigneeId) this.selectedAssigneeId = this.customSettings?.selectedAssigneeId;

    const savedBranch = localStorage.getItem('selectedTargetBranch') || 'master_ah';
    const allowedBranches = [
      this.customSettings?.supportBranch,
      this.customSettings?.releaseBranch,
      this.customSettings?.liveBranch
    ];

    if (savedBranch && allowedBranches.includes(savedBranch)) {
      this.targetBranch = savedBranch;
      this.showBranchSelector = true;
    }else{
      this.targetBranch = allowedBranches[0] || 'master_ah';
      this.showBranchSelector = true;
    }
    this.cdr.detectChanges(); 
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
          formData.append('reviewer_ids[]', this.selectedAssigneeId.toString());
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

      await this.loadProjectsWithCommitInfo();
      this.loaderService.hide();
      this.showMRResultsSummary(results);
    } catch (error) {
      this.loaderService.hide();
    }
  }

  async loadProjectsWithCommitInfo(): Promise<void> {
    try {
      this.loaderService.showLoading('Loading projects info...');

      const useCustomBranch = this.customSettings?.useCustomBranch ?? false;
      const sourceBranch = useCustomBranch
        ? this.customSettings?.sourceBranch ?? ''
        : '';

      const validProjects = (this.customSettings?.projects || []).filter(
        p => p.is_selected && p.local_repo_path
      );

      // 🔹 get current branches locally
      const projectsWithBranch = await Promise.all(
        validProjects.map(async p => ({
          ...p,
          current_branch: useCustomBranch
            ? sourceBranch
            : await this.runGit(p.local_repo_path, 'rev-parse --abbrev-ref HEAD')
        }))
      );

      // 🔥 ONE GraphQL CALL
      const graphData = await this.fetchProjectsInfo(
        projectsWithBranch,
        sourceBranch,
        this.targetBranch
      );

      // 🔄 map response + REST compare
      const finalData = await Promise.all(
        projectsWithBranch.map(async p => {
          const alias = p.project_name.replace(/[^a-zA-Z0-9_]/g, '_');
          const data = graphData[alias];

          const sourceSha = data?.repository?.source?.sha;
          const targetSha = data?.repository?.target?.sha;

          let commitsAhead = 0;
          let commitsBehind = 0;

          if (sourceSha && targetSha) {
            const compare = await this.baseService.getAhead(p.project_id, targetSha, sourceSha); // REST call
            const json = await compare.json();

            commitsAhead = json?.commits?.length ?? 0;
            commitsBehind = json?.commits?.length ?? 0;
          }

          const latest = data?.mergeRequests?.nodes[0]?.state; // Assuming sorted by created date
          let mrStatus = 'Created';
          if (latest === undefined) mrStatus = 'No MR';
          if (latest === 'merged') mrStatus = 'Merged';
          if (latest === 'closed') mrStatus = 'Rejected';

          return {
            ...p,
            commits_ahead: commitsAhead,
            commits_behind: commitsBehind,
            mr_status: mrStatus,
            sourceBranchExists: sourceSha ? true : false,
            targetBranchExists: targetSha ? true : false,
            is_selected: false,
            target_branch: this.targetBranch
          } as ProjectListModel;
        })
      );

      this.dataSource.data = finalData;
      this.lastRefreshed = new Date();
      this.loaderService.hide();

    } catch (error) {
      window.electronAPI.logError("loadProjectsWithCommitInfo CRASHED", error);
      this.handleError(error);
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

  onTargetBranchChange(){
    localStorage.setItem('selectedTargetBranch', this.targetBranch);

    this.loadProjectsWithCommitInfo();
  }

  getBranchChipType(exists: boolean | undefined): 'success' | 'error' | 'neutral' | '' {
    if (exists === true) return 'success';
    if (exists === false) return 'error';
    return '';
  }

  get hasSelectedProject(): boolean {
    return this.customSettings?.projects?.some(p => p.is_selected) ?? false;
  }

  private buildProjectInfoQuery(projects: ProjectSettingModel[], sourceBranch: string, targetBranch: string): string {

    const projectQueries = projects.map(p => {
      const alias = p.project_name.replace(/[^a-zA-Z0-9_]/g, '_');

      return `${alias}: project(fullPath: "pdp/${p.project_name}") {
                repository {
                  source: commit(ref: "${sourceBranch}") {
                    sha
                  }

                  target: commit(ref: "${targetBranch}") {
                    sha
                  }
                }

                mergeRequests(
                  sourceBranches: ["${sourceBranch}"]
                  targetBranches: ["${targetBranch}"]
                ) {
                  count
                  nodes {
                    state
                  }
                }
              }`;
    }).join('\n');

    return `{ ${projectQueries} }`;
  }
  
  
  private async fetchProjectsInfo(
    projects: ProjectSettingModel[],
    sourceBranch: string,
    targetBranch: string
  ) {
    const token = (await window.electronAPI.getToken()).token;

    const query = this.buildProjectInfoQuery(
      projects,
      sourceBranch,
      targetBranch
    );

    const response = await fetch(
      'https://git.promptdairytech.com/api/graphql',
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      }
    );

    const json = await response.json();
    return json.data || {};
  }
  
}

