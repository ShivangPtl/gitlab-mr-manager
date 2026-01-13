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

      await this.updateMrStatus();
      this.loaderService.hide();
      this.showMRResultsSummary(results);
    } catch (error) {
      this.loaderService.hide();
    }
  }

  async loadProjectsWithCommitInfo(): Promise<void> {    
    try {
      window.electronAPI.logInfo("==== loadProjectsWithCommitInfo STARTED ====");
      this.loaderService.showLoading('Loading projects info...');

      const useCustomBranch: boolean = this.customSettings?.useCustomBranch ?? false;
      const sourceBranch: string = useCustomBranch ? this.customSettings?.sourceBranch ?? '' : '';

      window.electronAPI.logInfo("Settings", {
        useCustomBranch,
        sourceBranch,
        targetBranch: this.targetBranch
      });

      const validProjects = (this.customSettings?.projects || []).filter(
        (p: ProjectSettingModel) => p.is_selected && p.local_repo_path
      );

      const projectPromises = validProjects.map(async (project: any) => {
        try {
          this.loaderService.showLoading(`Loading repositories....`);

          // Determine current branch
          const current_branch = !useCustomBranch
            ? await this.runGit(project.local_repo_path, 'rev-parse --abbrev-ref HEAD')
            : sourceBranch;

          window.electronAPI.logInfo("Detected branch", {
            project: project.project_name,
            current_branch
          });

          // Fetch project data with branch validation
          const {
            commits_ahead,
            mr_status,
            sourceBranchExists,
            targetBranchExists
          } = await this.fetchProjectCommitsAndMRStatus(
            project,
            current_branch,
          );

          window.electronAPI.logInfo("Branch check result", {
            project: project.project_name,
            commits_ahead,
            mr_status,
            sourceBranchExists,
            targetBranchExists
          });

          this.loaderService.showLoading(`Loading ${project.project_name} info...`);

          return {
            ...project,
            current_branch,
            target_branch: this.targetBranch,
            commits_ahead,
            mr_status,
            is_selected: false,
            sourceBranchExists,
            targetBranchExists
          } as ProjectListModel;
        } catch (error) {
          window.electronAPI.logError("Project failed", {
            project: project.project_name,
            error: error
          });
          console.error(`Error processing project ${project.project_name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(projectPromises);
      const filteredProjects = results.filter(p => p !== null && p !== undefined) as ProjectListModel[];

      this.dataSource.data = filteredProjects;
      window.electronAPI.logInfo("Final project list", filteredProjects);
      this.lastRefreshed = new Date();
      this.loaderService.hide();
      window.electronAPI.logInfo("==== loadProjectsWithCommitInfo COMPLETED ====");
    } catch (error) {
      window.electronAPI.logError("loadProjectsWithCommitInfo CRASHED", error);
      this.handleError(error);
    }
  }


async branchExists(repoPath: string, branch: string): Promise<boolean> {
  try {
    const output = await this.runGit(
      repoPath,
      `rev-parse --verify origin/${branch}`
    );
    return !!output;
  } catch {
    return false;
  }
}

//   async updateMrStatus(): Promise<void> {
//   try {
//     let selectedProjects = this.dataSource.data.filter(p => p.is_selected);
//     if (selectedProjects.length === 0) {
//       selectedProjects = this.dataSource.data;
//     }
//     if (selectedProjects.length === 0) {
//       this.snackBar.open('No Projects Found!', 'Close', { duration: 3000 });
//       this.loaderService.hide();
//       return;
//     }

//     // Process all selected projects in parallel
//     const updatePromises = selectedProjects.map(async (project) => {
//       try {
//         // Run MR status fetch and git commit count in parallel
//         const [mr_status, commits_ahead_str] = await Promise.all([
//           this.fetchMRStatus(
//             project.project_id, 
//             project.current_branch, 
//             project.target_branch, 
//             true
//           ),
//           this.runGit(
//             project.local_repo_path,
//             `rev-list --count origin/${project.target_branch}..origin/${project.current_branch}`
//         )
//         ]);

//         const commits_ahead = parseInt(commits_ahead_str || '0');

//         return {
//           project_id: project.project_id,
//           mr_status,
//           commits_ahead
//         };
//       } catch (error) {
//         console.error(`Error updating project ${project.project_name}:`, error);
//         return {
//           project_id: project.project_id,
//           mr_status: project.mr_status, // Keep existing status on error
//           commits_ahead: project.commits_ahead
//         };
//       }
//     });

//     // Wait for all updates to complete
//     const updates = await Promise.all(updatePromises);

//     // Create a map for O(1) lookup
//     const updatesMap = new Map(
//       updates.map(u => [u.project_id, u])
//     );

//     // Update dataSource once with all changes
//     this.dataSource.data = this.dataSource.data.map(p => {
//       const update = updatesMap.get(p.project_id);
//       if (update) {
//         return {
//           ...p,
//           is_selected: false,
//           mr_status: update.mr_status,
//           commits_ahead: update.commits_ahead
//         };
//       }
//       return p;
//     });

//     // Load settings once at the end
//     const settings = await window.electronAPI.getSettings();
//     if (settings.selectedAssigneeId) this.selectedAssigneeId = settings.selectedAssigneeId;
    
//     this.labels.forEach(l => l.is_selected = false);
//     this.mrTitle = '';
//     this.mrDescription = '';
//     this.loaderService.hide();
//   } catch (error) {
//     this.handleError(error);
//   }
// }

  async updateMrStatus(): Promise<void> {
    try {
      this.loaderService.showLoading('Refreshing...');

      let selectedProjects = this.dataSource.data.filter(p => p.is_selected);
      if (selectedProjects.length === 0) {
        selectedProjects = this.dataSource.data;
      }
      if (selectedProjects.length === 0) {
        this.snackBar.open('No Projects Found!', 'Close', { duration: 3000 });
        this.loaderService.hide();
        return;
      }

      const updatePromises = selectedProjects.map(async (project) => {
        try {
          // Fetch project data with branch validation
          const {
            commits_ahead,
            mr_status,
            sourceBranchExists,
            targetBranchExists
          } = await this.fetchProjectCommitsAndMRStatus(
            project,
            project.current_branch,
          );

          return {
            project_id: project.project_id,
            mr_status,
            commits_ahead,
            sourceBranchExists,
            targetBranchExists
          };
        } catch (error) {
          console.error(`Error updating project ${project.project_name}:`, error);
          return {
            project_id: project.project_id,
            mr_status: project.mr_status,
            commits_ahead: project.commits_ahead,
            sourceBranchExists: project.sourceBranchExists,
            targetBranchExists: project.targetBranchExists
          };
        }
      });

      const updates = await Promise.all(updatePromises);
      const updatesMap = new Map(updates.map(u => [u.project_id, u]));

      this.dataSource.data = this.dataSource.data.map(p => {
        const update = updatesMap.get(p.project_id);
        if (update) {
          return {
            ...p,
            is_selected: false,
            mr_status: update.mr_status ?? '-', // Fallback to existing value
            commits_ahead: update.commits_ahead ?? '-', // Fallback to existing value
            sourceBranchExists: update.sourceBranchExists ?? p.sourceBranchExists,
            targetBranchExists: update.targetBranchExists ?? p.targetBranchExists
          } as ProjectListModel; // Type assertion to ensure correct type
        }
        return p;
      });

      const settings = await window.electronAPI.getSettings();
      if (settings.selectedAssigneeId) this.selectedAssigneeId = settings.selectedAssigneeId;

      this.labels.forEach(l => l.is_selected = false);
      this.mrTitle = '';
      this.mrDescription = '';
      this.lastRefreshed = new Date();
      this.loaderService.hide();
    } catch (error) {
      this.handleError(error);
    }
  }

  async fetchMRStatus(projectId: number, sourceBranch: string, targetBranch: string, showMessage = true): Promise<'Created' | 'Merged' | 'Rejected' | 'No MR' | 'Error'> {
    try {
      const project = this.dataSource.data.find(e => e.project_id == projectId);

      if (showMessage) {
        this.loaderService.showLoading(`Loading ${project?.project_name} info...`);
      }

      const url = `${this.gitlabApiBase}/projects/${projectId}/merge_requests?source_branch=${encodeURIComponent(sourceBranch)}&target_branch=${encodeURIComponent(targetBranch)}&state=all`;

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

  onTargetBranchChange(){
    localStorage.setItem('selectedTargetBranch', this.targetBranch);

    this.loadProjectsWithCommitInfo();
  }

  getBranchChipType(exists: boolean | undefined): 'success' | 'error' | 'neutral' | '' {
    if (exists === true) return 'success';
    if (exists === false) return 'error';
    return '';
  }


  private async fetchProjectCommitsAndMRStatus(
    project: any,
    currentBranch: string,
  ): Promise<{
    commits_ahead: number;
    mr_status: string;
    sourceBranchExists: boolean;
    targetBranchExists: boolean;
  }> {

    window.electronAPI.logInfo("Checking branches", {
      project: project.project_name,
      source: currentBranch,
      target: this.targetBranch
    });

    // Check branch existence
    const [sourceExists, targetExists] = await Promise.all([
      this.baseService.branchExists(project.project_id, currentBranch),
      this.baseService.branchExists(project.project_id, this.targetBranch)
    ]);

    window.electronAPI.logInfo("Branch API response", {
      project: project.project_name,
      sourceExists,
      targetExists
    });

    // If branches don't exist, return early with specific branch info
    if (!sourceExists || !targetExists) {
      window.electronAPI.logWarn("Branch missing", {
        project: project.project_name,
        sourceExists,
        targetExists
      });

      return {
        commits_ahead: 0,
        mr_status: 'No MR',
        sourceBranchExists: sourceExists,
        targetBranchExists: targetExists
      };
    }

    // Fetch commits ahead and MR status in parallel
    const [mr_status, commits_ahead_res] = await Promise.all([
      this.fetchMRStatus(
        project.project_id,
        currentBranch,
        this.targetBranch,
      ),
      this.baseService.getAhead(project.project_id, this.targetBranch, currentBranch)
    ]);

    const commits_ahead = commits_ahead_res.ok
      ? (await commits_ahead_res.json())?.commits?.length || 0
      : 0;

    return {
      commits_ahead,
      mr_status,
      sourceBranchExists: true,
      targetBranchExists: true
    };
  }

  get hasSelectedProject(): boolean {
    return this.customSettings?.projects?.some(p => p.is_selected) ?? false;
  }
}

