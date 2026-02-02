import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  showBranchSelector = false;

  constructor(private loaderService: LoaderService, private snackBar: MatSnackBar, private dialog: MatDialog, 
    private cdr: ChangeDetectorRef, 
    private baseService: BaseService
  ) {}
  async ngOnInit() {
    this.customSettings = await window.electronAPI.getSettings();
    this.token = (await window.electronAPI.getToken()).token;

    const savedBranch = localStorage.getItem('selectedTargetBranch') || 'master_ah';
    const allowedBranches = [
      this.customSettings?.supportBranch,
      this.customSettings?.releaseBranch,
      this.customSettings?.liveBranch
    ];

    if (savedBranch && allowedBranches.includes(savedBranch)) {
      this.sourceBranch = savedBranch;
      this.showBranchSelector = true;
    } else {
      this.sourceBranch = allowedBranches[0] || 'master_ah';
      this.showBranchSelector = true;
    }
    this.cdr.detectChanges(); 

    await this.loadProjects();
    await this.compareBranches();
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

    const projectsWithBranch = await Promise.all(
      targetList.map(async p => ({
        ...p,
        current_branch: this.sourceBranch
      }))
    );

    const graphData = await this.fetchProjectsInfo(
            projectsWithBranch,
            this.sourceBranch,
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
        let configDiffs: any[] = [];
        let configFiles: string[] = [];
  
        if (sourceSha && targetSha) {
          const aheadCompare = await this.baseService.getAhead(p.project_id, targetSha, sourceSha); // REST call
          const aheadJson = await aheadCompare.json();

          const behindCompare = await this.baseService.getAhead(p.project_id, sourceSha, targetSha); // REST call
          const behindJson = await behindCompare.json();
  
          commitsAhead = aheadJson?.commits?.length ?? 0;
          commitsBehind = behindJson?.commits?.length ?? 0;
            
          configDiffs = (aheadJson?.diffs || [])
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

          configFiles = configDiffs.map((d: any) =>
            d.file.split('/').pop()
          );
        }

        return {
          ...p,
          ahead: commitsAhead,
          behind: commitsBehind,
          sourceBranchExists: sourceSha ? true : false,
          targetBranchExists: targetSha ? true : false,
          configDiffs: configDiffs,
          configFiles: configFiles
        }
    }));

    this.dataSource.data = [...finalData];
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
                }`;
    }).join('\n');

    return `{ ${projectQueries} }`;
    }
}