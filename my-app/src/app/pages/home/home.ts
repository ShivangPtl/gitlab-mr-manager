import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { UserItem } from '../../models/user-item.model';
import { LabelItem } from '../../models/label-item.model';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { ProjectListModel } from '../../models/project-list.model';
import { LoaderService } from '../../services/loader';
import { GitlabAuth } from '../../services/gitlab-auth';
import { BaseService } from '../../services/base-service';
import { CustomSettings } from '../settings/settings';
import { Badge } from '../../components/badge/badge';
import { getProjectType } from '../../../shared/base';

declare const window: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatFormFieldModule, MatSelectModule, MatCheckboxModule, MatOptionModule,
    MatTableModule, MatButtonModule, MatInputModule, MatSnackBarModule,
    MatIconModule, Badge
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class Home implements OnInit {
  targetBranch = '';
  assignees: UserItem[] = [];
  labels: LabelItem[] = [];
  selectedAssigneeId = 119;
  mrTitle = '';
  mrDescription = '';
  dataSource = new MatTableDataSource<ProjectListModel>();
  lastRefreshed: Date | null = null;
  customSettings?: CustomSettings;
  showBranchSelector = false;
  getProjectType = getProjectType;

  constructor(
    private loaderService: LoaderService,
    private snackBar: MatSnackBar,
    private authService: GitlabAuth,
    private cdr: ChangeDetectorRef,
    private baseService: BaseService
  ) {}

  async ngOnInit() {
    await this.baseService.getToken(); // warm up cache
    this.customSettings = await window.electronAPI.getSettings();
    this.assignees = this.authService.userList;

    this.labels = [
      { name: 'Task', is_selected: false },
      { name: 'Urgent', is_selected: false },
      { name: 'High', is_selected: false },
      { name: 'Feature', is_selected: false },
      { name: 'Bug', is_selected: false },
      { name: 'User Story', is_selected: false },
      { name: 'Branch Merge', is_selected: false },
    ];

    if (this.customSettings?.selectedAssigneeId) {
      this.selectedAssigneeId = this.customSettings.selectedAssigneeId;
    }

    const branches = [
      this.customSettings?.supportBranch,
      this.customSettings?.releaseBranch,
      this.customSettings?.liveBranch,
    ].filter(Boolean) as string[];

    // Restore last-used branch (stored in electron-store via settings fallback)
    const saved = localStorage.getItem('selectedTargetBranch');
    this.targetBranch = (saved && branches.includes(saved)) ? saved : (branches[0] ?? '');
    this.showBranchSelector = branches.length > 1;
    this.cdr.detectChanges();

    await this.loadProjectsWithCommitInfo();
  }

  onTargetBranchChange() {
    localStorage.setItem('selectedTargetBranch', this.targetBranch);
    this.loadProjectsWithCommitInfo();
  }

  async loadProjectsWithCommitInfo(): Promise<void> {
    try {
      this.loaderService.showLoading('Loading projects…');

      const useCustomBranch = this.customSettings?.useCustomBranch ?? false;
      const sourceBranch = useCustomBranch ? (this.customSettings?.sourceBranch ?? '') : '';

      const validProjects = (this.customSettings?.projects || []).filter(
        p => p.is_selected && p.local_repo_path
      );

      const projectsWithBranch = await Promise.all(
        validProjects.map(async p => ({
          ...p,
          current_branch: useCustomBranch
            ? sourceBranch
            : await window.electronAPI.runGitCommand(p.local_repo_path, 'rev-parse --abbrev-ref HEAD')
        }))
      );

      const graphData = await this.fetchProjectsInfo(projectsWithBranch, sourceBranch, this.targetBranch);

      const finalData = await Promise.all(
        projectsWithBranch.map(async p => {
          const alias = p.project_name.replace(/[^a-zA-Z0-9_]/g, '_');
          const data = graphData[alias];

          const sourceSha = data?.repository?.source?.sha;
          const targetSha = data?.repository?.target?.sha;

          let commitsAhead = 0;
          if (sourceSha && targetSha) {
            const compare = await this.baseService.getAhead(p.project_id, targetSha, sourceSha);
            const json = await compare.json();
            commitsAhead = json?.commits?.length ?? 0;
          }

          const latest = data?.mergeRequests?.nodes?.[0]?.state;
          let mrStatus = 'No MR';
          if (latest === 'opened') mrStatus = 'Created';
          if (latest === 'merged') mrStatus = 'Merged';
          if (latest === 'closed') mrStatus = 'Rejected';

          return {
            ...p,
            commits_ahead: commitsAhead,
            mr_status: mrStatus,
            sourceBranchExists: !!sourceSha,
            targetBranchExists: !!targetSha,
            is_selected: false,
            target_branch: this.targetBranch,
          } as ProjectListModel;
        })
      );

      this.dataSource.data = finalData;
      this.lastRefreshed = new Date();
    } catch (error) {
      window.electronAPI.logError('loadProjectsWithCommitInfo CRASHED', error);
      this.showError(error);
    } finally {
      this.loaderService.hide();
    }
  }

  async createMergeRequests() {
    const selected = this.dataSource.data.filter(p => p.is_selected);
    if (!selected.length) return;

    const selectedLabels = this.labels.filter(l => l.is_selected).map(l => l.name).join(',');
    const results: { project: string; status: 'success' | 'failed'; message: string }[] = [];

    for (const proj of selected) {
      this.loaderService.showLoading(`Creating MR for ${proj.project_name}…`);
      try {
        const commitMsg = await window.electronAPI.runGitCommand(proj.local_repo_path, 'log -1 --pretty=%B');
        const title = this.mrTitle?.trim() || commitMsg.split('\n')[0]?.trim() || 'Automated MR';
        const description = this.mrDescription?.trim() || (commitMsg.length < 1000 ? commitMsg.trim() : 'Created from GitLabMRManager');

        const form = new URLSearchParams({
          source_branch: proj.current_branch,
          target_branch: proj.target_branch,
          title,
          description,
          assignee_id: this.selectedAssigneeId.toString(),
          'reviewer_ids[]': this.selectedAssigneeId.toString(),
          labels: selectedLabels,
        });

        const response = await this.baseService.restPostForm(
          `/projects/${proj.project_id}/merge_requests`,
          form
        );

        if (response.ok) {
          results.push({ project: proj.project_name, status: 'success', message: 'Created' });
        } else {
          const text = await response.text();
          results.push({ project: proj.project_name, status: 'failed', message: this.extractErrorMessage(text) });
        }
      } catch (ex: any) {
        results.push({ project: proj.project_name, status: 'failed', message: ex.message });
      } finally {
        this.loaderService.hide();
      }
    }

    await this.loadProjectsWithCommitInfo();
    this.showMRResultsSummary(results);
  }

  private async fetchProjectsInfo(projects: ProjectSettingModel[], sourceBranch: string, targetBranch: string) {
    const q = projects.map(p => {
      const alias = p.project_name.replace(/[^a-zA-Z0-9_]/g, '_');
      return `${alias}: project(fullPath: "pdp/${p.project_name}") {
        repository {
          source: commit(ref: "${sourceBranch}") { sha }
          target: commit(ref: "${targetBranch}") { sha }
        }
        mergeRequests(sourceBranches: ["${sourceBranch}"], targetBranches: ["${targetBranch}"]) {
          nodes { state }
        }
      }`;
    }).join('\n');

    return this.baseService.graphql(`{ ${q} }`);
  }

  isAnySelected() { return this.dataSource.data.some(p => p.is_selected); }

  getBranchChipType(exists: boolean | undefined): 'success' | 'error' | '' {
    if (exists === true) return 'success';
    if (exists === false) return 'error';
    return '';
  }

  get hasSelectedProject() {
    return this.customSettings?.projects?.some(p => p.is_selected) ?? false;
  }

  private extractErrorMessage(text: string): string {
    try {
      const json = JSON.parse(text);
      if (typeof json.message === 'string') return json.message;
      if (typeof json.message === 'object') return Object.values(json.message).flat().join(', ');
    } catch { return text; }
    return 'Unknown error';
  }

  private showMRResultsSummary(results: { project: string; status: string; message: string }[]) {
    const ok = results.filter(r => r.status === 'success');
    const err = results.filter(r => r.status !== 'success');

    if (ok.length) {
      this.snackBar.open(`✅ ${ok.length} MR(s) created: ${ok.map(r => r.project).join(', ')}`, 'Close', {
        duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['success-snackbar']
      });
    }
    if (err.length) {
      this.snackBar.open(`❌ ${err.length} failed: ${err.map(r => r.project).join(', ')}`, 'Close', {
        duration: 5000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['error-snackbar']
      });
    }
  }

  private showError(error: unknown) {
    this.loaderService.forceHide();
    const msg = error instanceof Error ? error.message : String(error);
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
  }
}