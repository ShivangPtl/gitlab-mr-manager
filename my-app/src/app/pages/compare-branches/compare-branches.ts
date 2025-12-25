import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
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
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from "@angular/material/icon";
import { ConfigDiffDialogComponent } from './config-diff-dialog/config-diff-dialog';
import { MatDialog } from '@angular/material/dialog';
import { Badge } from "../../components/badge/badge";
import { BaseService } from '../../services/base-service';
import { CustomSettings } from '../settings/settings';
import { getProjectType } from '../../../shared/base';

declare const window: any;
@Component({
  selector: 'app-compare-branches',
  imports: [CommonModule, FormsModule, Navbar,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatOptionModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatTooltip, MatIcon, Badge],
  templateUrl: './compare-branches.html',
  styleUrl: './compare-branches.scss'
})
export class CompareBranches {

  sourceBranch = '';
  targetBranch = 'master_ah';
  getProjectType = getProjectType;
  token = '';
  displayedColumns = [
    'select',
    'name',
    'branches',
    'ahead',
    'behind',
    'deploy',
    'config'
  ];
  dataSource = new MatTableDataSource<any>();
  lastRefreshed: Date | null = null;
  customSettings?: CustomSettings;

  /** SAME PATTERNS AS C# */
  configFilePatterns = [
    /^appsettings.*\.json$/i,
    /^ocelot.*\.json$/i
  ];
  baseUrl = 'https://git.promptdairytech.com/api/v4';

  constructor(private loaderService: LoaderService, private snackBar: MatSnackBar, private dialog: MatDialog,
    private baseService: BaseService
  ) {}
  async ngOnInit() {
    this.customSettings = await window.electronAPI.getSettings();
    this.token = (await window.electronAPI.getToken()).token;
    this.loadProjects();
  }

  async loadProjects() {
    //const settings = await window.electronAPI.getSettings();
    this.dataSource.data = (this.customSettings?.projects || []).filter((p : any) => p.is_selected);

    const validProjects = (this.customSettings?.projects || []).filter(
      (p: ProjectSettingModel) => p.is_selected);
    
    this.dataSource.data = validProjects.map((p : any) => ({
      ...p,
      is_selected: false,
      ahead: '-',
      behind: '-',
      configFiles: [],
      configDiffs: [], 
      sourceBranchExists: undefined,
      targetBranchExists: undefined
    }));
  }

  async compareBranches() {

    this.dataSource.data = this.dataSource.data.map((p: any) => ({
      ...p,
      ahead: '-',
      behind: '-',
      configFiles: [],
      configDiffs: [],
      sourceBranchExists: undefined,
      targetBranchExists: undefined
    }));

    if (!this.sourceBranch.trim()) {
      this.snackBar.open('Enter source branch!', 'Close', { duration: 3000 });
      return;
    }

    if (!this.targetBranch.trim()) {
      this.snackBar.open('Enter target branch!', 'Close', { duration: 3000 });
      return;
    }

    const selected = this.dataSource.data.filter(p => p.is_selected);
    const targetList = selected.length ? selected : this.dataSource.data;

    this.loaderService.showLoading('Comparing branches…');

    const headers = { 'PRIVATE-TOKEN': this.token };

    await Promise.all(
      targetList.map(async (proj: any) => {
        try {
          /* 1️⃣ Check branch existence in parallel */
          const [sourceExists, targetExists] = await Promise.all([
            this.baseService.branchExists(proj.project_id, this.sourceBranch),
            this.baseService.branchExists(proj.project_id, this.targetBranch)
          ]);

          proj.sourceBranchExists = sourceExists;
          proj.targetBranchExists = targetExists;

          if (!sourceExists || !targetExists) {
            proj.ahead = '-';
            proj.behind = '-';
            proj.configFiles = [];
            proj.configDiffs = [];
            return;
          }

          /* 2️⃣ Compare BOTH directions in parallel */
          const [aheadRes, behindRes] = await Promise.all([
            this.baseService.getAhead(proj.project_id, this.targetBranch, this.sourceBranch),
            this.baseService.getAhead(proj.project_id, this.sourceBranch, this.targetBranch)
          ]);

          if (!aheadRes.ok || !behindRes.ok) {
            proj.ahead = '-';
            proj.behind = '-';
            proj.configFiles = [];
            proj.configDiffs = [];
            return;
          }

          const [aheadData, behindData] = await Promise.all([
            aheadRes.json(),
            behindRes.json()
          ]);

          /* 3️⃣ Set ahead / behind */
          proj.ahead = aheadData.commits?.length || 0;
          proj.behind = behindData.commits?.length || 0;

          /* 4️⃣ Extract config diffs (only from AHEAD) */
          proj.configDiffs = (aheadData.diffs || [])
            .filter((d: any) => {
              const file = d.new_path?.split('/').pop();
              return this.configFilePatterns.some(rx => rx.test(file));
            })
            .map((d: any) => ({
              file: d.new_path,
              diff: d.diff,
              newFile: d.new_file,
              renamedFile: d.renamed_file,
              deletedFile: d.deleted_file
            }));

          proj.configFiles = proj.configDiffs.map((d: any) =>
            d.file.split('/').pop()
          );

        } catch {
          proj.sourceBranchExists = false;
          proj.targetBranchExists = false;
          proj.ahead = '-';
          proj.behind = '-';
          proj.configFiles = [];
          proj.configDiffs = [];
        }
      })
    );

    this.dataSource.data = [...this.dataSource.data];
    this.lastRefreshed = new Date();
    this.loaderService.hide();
  }
  

  /** DEPLOY STATUS */
  getDeployIcon(p: any): string {
    if (!p.sourceBranchExists || (p.ahead === 0 || p.ahead === '-')) return '❌';
    return '✅';
  }

  getDeployClass(p: any): string {
    // if (!p.sourceBranchExists || !p.targetBranchExists) return 'invalid';
    if (!p.sourceBranchExists || (p.ahead === 0 || p.ahead === '-')) return 'no-deploy';
    if (p.configFiles?.length) return 'manual';
    return 'ready';
  }

  getDeployText(p: any): string {
    if (!p.sourceBranchExists) return 'Source branch does not exist';
    if (!p.targetBranchExists) return 'Target branch does not exist';
    if (p.ahead === 0 || p.ahead === '-') return 'Nothing to deploy';
    if (p.configFiles?.length) return 'Manual config deployment required';
    return 'Ready to deploy';
  }

  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }

  openConfigDetails(project: any) {
    this.dialog.open(ConfigDiffDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
      data: {
        projectName: project.project_name,
        sourceBranch: this.sourceBranch,
        targetBranch: this.targetBranch,
        diffs: project.configDiffs
      }
    });
  }

  resetDataSource() {
    this.dataSource.data = this.dataSource.data.map((p: any) => ({
      ...p,
      is_selected: false,
      ahead: '-',
      behind: '-',
      configFiles: [],
      configDiffs: [],
      sourceBranchExists: undefined,
      targetBranchExists: undefined
    }));
  }

  getBranchChipType(exists: boolean | undefined): 'success' | 'error' | 'neutral' | '' {
    if (exists === true) return 'success';
    if (exists === false) return 'error';
    return '';
  }

  get hasSelectedProject(): boolean {
    return this.customSettings?.projects?.some((p: any) => p.is_selected) || false;
  }
  
}