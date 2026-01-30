import { Component, OnInit } from '@angular/core';
import { LoaderService } from '../../services/loader';
import { MatTableDataSource } from '@angular/material/table';
import { Navbar } from '../navbar/navbar';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PipelineDetailsDialogComponent } from './pipeline-details-dialog/pipeline-details-dialog';
import { Badge } from '../../components/badge/badge';
import { CustomSettings } from '../settings/settings';
import { getProjectType } from '../../../shared/base';

declare const window: any;

@Component({
  selector: 'app-pipelines',
  templateUrl: './pipelines.html',
  styleUrls: ['./pipelines.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatOptionModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatIconModule,
    Badge
  ],
})
export class Pipelines implements OnInit {
  targetBranch = 'master_ah';
  getProjectType = getProjectType;
  constructor(
    private loader: LoaderService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.targetBranch = localStorage.getItem('selectedTargetBranch') || 'master_ah';
   }

  // columns = ['select', 'project', 'type', 'user', 'created', 'status', 'info', 'link'];

  columns: string[] = [];
  dataSource = new MatTableDataSource<PipelineRow>();
  lastRefreshed: Date | null = null;
  customSettings?: CustomSettings;
  showBranchSelector = false;
  selectedRows = new Set<PipelineRow>();
  token: string = '';
  isAdmin = false;
  // Tracks pipelines that are currently running / pending
  activePipelines = new Map<
    string, // project_name
    {
      scheduleId: string | null;
      status: string;
      lastUpdated: Date;
    }
  >();

  private pipelinePoller: any = null;
  private readonly POLL_INTERVAL_MS = 60000; // 1min

  async ngOnInit() {
    const tokenData = await window.electronAPI.getToken();
    this.token = tokenData.token;
    this.customSettings = await window.electronAPI.getSettings();
    this.isAdmin = tokenData.isAdmin;

    if(this.isAdmin){
      this.columns = ['select', 'project', 'user', 'created', 'status', 'info', 'link'];
    }else{
      this.columns = ['project', 'user', 'created', 'status', 'info', 'link'];
    }

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

    await this.refreshPipelines();
    this.startPipelinePolling();
  }

  // private async processProjectPipelines(proj: any, branch: string): Promise<PipelineRow[]> {

  //   const rows: PipelineRow[] = [];

  //   const pipelines = await this.fetchPipelines(
  //     proj.project_name,
  //     branch
  //   );

  //   let goodPipeline: any = null;
  //   const pendingPipelines: any[] = [];

  //   for (const p of pipelines) {
  //     const status = p.status?.toLowerCase();

  //     if (!goodPipeline && ['running', 'success', 'failed', 'canceled'].includes(status)) {
  //       goodPipeline = p;
  //     }

  //     if (['pending', 'created'].includes(status)) {
  //       pendingPipelines.push(p);
  //     }
  //   }

  //   if (goodPipeline) {
  //     rows.push(this.toRow(proj.project_name, 'Latest', goodPipeline));
  //   }

  //   for (const p of pendingPipelines) {
  //     rows.push(this.toRow(proj.project_name, 'Pending/Created', p));
  //   }

  //   return rows;
  // }

  private async processProjectPipelines(
    proj: any,
    branch: string
  ): Promise<PipelineRow> {

    const pipelines = await this.fetchPipelines(
      proj.project_name,
      branch
    );

    // ✅ Sort pipelines by createdAt DESC
    const latestPipeline = pipelines
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    const matchedSchedule = await this.getMatchedSchedule(
      proj.project_name,
      branch
      );

    // ✅ Always return ONE row
    const row = this.toRow(
      proj.project_name,
      'Latest',
      latestPipeline ?? null
    );

    row.matchedSchedule = matchedSchedule
      ? { id: matchedSchedule.id, name: matchedSchedule.name }
      : null;

      // if(latestPipeline?.status?.toLowerCase() === 'running' || latestPipeline?.status?.toLowerCase() === 'pending' 
      // || latestPipeline?.status?.toLowerCase() === 'created'){
      //   this.activePipelines.set(row.project_name, {
      //     scheduleId: matchedSchedule?.id ?? null,
      //     status: latestPipeline?.status,
      //     lastUpdated: new Date()
      //   });
      // }

    this.addActivePipeline(row);

    return row;
  }
  

  async refreshPipelines(onlyActive: boolean = false) {
    try {
      if (!onlyActive) {
        this.loader.showLoading('Fetching pipelines…');
      }

      //const selectedProjects = this.customSettings?.projects.filter((p: any) => p.is_selected) || [];

      let selectedProjects = this.customSettings?.projects.filter(
        (p: any) => p.is_selected && p.project_name.toLowerCase() !== 'common'  
      ) || [];

      // if (onlyActive) {
      //   const activeProjectNames = Array.from(this.activePipelines.keys());

      //   selectedProjects = selectedProjects.filter(p =>
      //     activeProjectNames.includes(p.project_name)
      //   );

      //   // Nothing to refresh
      //   if (selectedProjects.length === 0) {
      //     return;
      //   }
      // }
      

      const branch = this.targetBranch;

      // 🔥 Create parallel tasks
      const tasks = selectedProjects.map(proj =>
        this.processProjectPipelines(proj, branch)
      );

      // 🔥 Run in parallel
      // const results = await Promise.all(tasks);

      // Flatten results
      // this.dataSource.data = results.flat();
      this.dataSource.data = await Promise.all(tasks);
      this.lastRefreshed = new Date();

    } catch (err) {
      this.showError(err);
    } finally {
      this.loader.hide();
    }
  }
  

  toRow(projectName: string, type: string, pipeline: any | null): PipelineRow {

    if (!pipeline) {
      return {
        project_name: projectName,
        type,
        status: 'NOT RUN',
        user: '-',
        created_at: '-',
        full_pipeline: null,
        link: `https://git.promptdairytech.com/pdp/${projectName}/-/pipelines`,
        matchedSchedule: null
      };
    }

    const isRunning = pipeline.status?.toLowerCase() === 'running';
    const pipelineDetails: PipelineDetails = {
      id: pipeline.id,
      source: pipeline.source,
      status: pipeline.status,
      ref: pipeline.ref,
      createdAt: this.formatDateTime(pipeline.createdAt),
      startedAt: this.formatDateTime(pipeline.startedAt),
      finishedAt: this.formatDateTime(pipeline.finishedAt),
      totalDuration: this.calculateDuration(
        pipeline.createdAt,
        pipeline.finishedAt,
        isRunning
      ),
      runDuration: pipeline.startedAt
        ? this.calculateDuration(
            pipeline.startedAt,
            pipeline.finishedAt,
            isRunning
          )
        : 'Waiting to start…',
      name: pipeline.user.name
    };
    return {
      project_name: projectName,
      type,
      status: pipeline.status?.toUpperCase() || 'UNKNOWN',
      user: pipeline.user?.name || '-',
      created_at: pipeline.createdAt ? this.formatDateTime(pipeline.createdAt) : '-',
      full_pipeline: pipelineDetails,
      link: `https://git.promptdairytech.com/pdp/${projectName}/-/pipeline_schedules`,
      matchedSchedule: null
    };
  }

  async fetchPipelines(projectName: string, branch: string): Promise<any[]> {
    const query = `
      {
        group(fullPath: "pdp") {
          projects(first: 1, search: "${projectName}") {
            nodes {
              pipelines(first: 5${branch ? `, ref: "${branch}"` : ''}) {
                nodes {
                  id
                  status
                  ref
                  createdAt
                  updatedAt
                  startedAt
                  finishedAt
                  duration
                  user { name }
                  source
                }
              }
            }
          }
        }
      }`;

    const response = await fetch('https://git.promptdairytech.com/api/graphql', {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();

    const nodes = json?.data?.group?.projects?.nodes?.[0]?.pipelines?.nodes || [];
    return nodes;
  }

  getStatusClass(status: string) {
    switch ((status || '').toLowerCase()) {
      case 'success': return 'success';
      case 'running': return 'running';
      case 'failed': return 'failed';
      case 'pending': return 'pending';
      case 'created': return 'created';
      case 'canceled': return 'canceled';
      default: return '';
    }
  }

  private showError(error: unknown) {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }

  openDetails(pipeline: any) {
  this.dialog.open(PipelineDetailsDialogComponent, {
    width: '600px',
    data: pipeline
  });
}

  formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return '-';

    const date = new Date(dateStr);

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }


  private calculateDuration(
    start: string | null,
    end: string | null,
    isRunning = false
  ): string {
    if (!start) return '-';
  
    const startTime = new Date(start).getTime();
    const endTime = end
      ? new Date(end).getTime()
      : isRunning
        ? Date.now()
        : null;
  
    if (!endTime || endTime < startTime) {
      if (isRunning) return this.formatDiff(Date.now() - startTime) + ' ⏳ (running…)';
      return '-';
    }
  
    return this.formatDiff(endTime - startTime);
  }
  
  private formatDiff(diffMs: number): string {
    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
  
    const hStr = hours > 0 ? `${hours}h ` : '';
    const mStr = minutes > 0 ? `${minutes}m ` : '';
    const sStr = `${seconds}s`;
  
    return `${hStr}${mStr}${sStr}`;
  }
  
  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }

  private async getMatchedSchedule(
    projectName: string,
    branch: string
  ): Promise<{ id: string; name: string } | null> {

    const token = (await window.electronAPI.getToken()).token;

    const query = `
    {
      group(fullPath: "pdp") {
        projects(first: 1, search: "${projectName}") {
          nodes {
            pipelineSchedules(first: 20) {
              nodes {
                id
                description
                ref
              }
            }
          }
        }
      }
    }`;

    const response = await fetch('https://git.promptdairytech.com/api/graphql', {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();

    const schedules =
      json?.data?.group?.projects?.nodes?.[0]?.pipelineSchedules?.nodes || [];

    if (!schedules.length) return null;

    const branchLower = branch.toLowerCase();

    // ✅ Priority 1: exact ref match
    const refMatch = schedules.find((s: any) =>
      s.ref?.toLowerCase() === branchLower
    );
    if (refMatch) {
      return { id: refMatch.id, name: refMatch.description };
    }

    // // ✅ Priority 2: description-based fallback
    // if (branchLower.includes('support')) {
    //   return schedules.find((s: any) =>
    //     s.description?.toLowerCase().includes('support')
    //   ) ?? null;
    // }

    // if (branchLower.includes('release')) {
    //   return schedules.find((s: any) =>
    //     s.description?.toLowerCase().includes('release')
    //   ) ?? null;
    // }

    // // UAT / Live
    // return schedules.find((s: any) =>
    //   s.description?.toLowerCase().includes('uat')
    // ) ?? null;

    return null;
  }
  
  toggleSelection(row: PipelineRow, checked: boolean) {
    if (checked) {
      this.selectedRows.add(row);
    } else {
      this.selectedRows.delete(row);
    }
  }

  isSelected(row: PipelineRow): boolean {
    return this.selectedRows.has(row);
  }
  
  get hasSelectedRows(): boolean {
    return this.selectedRows.size > 0;
  }
  
  async runSelected() {
    const rows = Array.from(this.selectedRows);

    this.loader.showLoading('Triggering pipelines…');

    try {
      for (const row of rows) {
        if (!row.matchedSchedule) continue;

        const status = (row.status || '').toLowerCase();
        if (['running', 'pending', 'created'].includes(status)) {
          console.warn(
            `Skipping ${row.project_name} — pipeline already ${row.status}`
          );
          continue;
        }

        if (this.activePipelines.has(row.project_name)) {
          console.warn(
            `Skipping ${row.project_name} — already triggered`
          );
          continue;
        }

        await this.playSchedule(row.matchedSchedule.id);

        // ✅ REGISTER as active (NEW)
        this.activePipelines.set(row.project_name, {
          scheduleId: row.matchedSchedule.id,
          status: 'created',
          lastUpdated: new Date()
        });
      }

      this.snackBar.open(
        `Pipelines triggered for ${rows.length} project(s)`,
        'Close',
        { duration: 4000 }
      );

      // ✅ Clear selection after run
      this.selectedRows.clear();
      await this.delay(4000);

      this.refreshPipelines(true);
      // 🔄 Start polling after triggering
      this.startPipelinePolling();

    } catch (err: any) {
      this.snackBar.open(
        err?.message || 'Failed to trigger pipeline',
        'Close',
        { duration: 4000 }
      );
    } finally {
      this.loader.hide();
    }
  }
  
  
  private async playSchedule(scheduleId: string): Promise<void> {
    const token = (await window.electronAPI.getToken()).token;

    const mutation = `
      mutation {
        pipelineSchedulePlay(input: {
          id: "${scheduleId}"
        }) {
          pipelineSchedule {
            id
          }
          errors
        }
      }
    `;

    const response = await fetch(
      'https://git.promptdairytech.com/api/graphql',
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: mutation })
      }
    );

    const json = await response.json();

    const errors = json?.data?.pipelineSchedulePlay?.errors;
    if (errors && errors.length) {
      throw new Error(errors.join(', '));
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  canRun(row: PipelineRow): boolean {
    if (!row.matchedSchedule) return false;

    const status = (row.status || '').toLowerCase();

    // ❌ already running or queued
    if (['running', 'pending', 'created'].includes(status)) {
      return false;
    }

    // ❌ already triggered from this screen
    if (this.activePipelines.has(row.project_name)) {
      return false;
    }

    return true;
  }
  
  private startPipelinePolling() {
    if (this.pipelinePoller) return; // already running

    this.pipelinePoller = setInterval(async () => {
      if (this.activePipelines.size === 0) {
        this.stopPipelinePolling();
        return;
      }

      await this.refreshPipelines(true);
      this.syncActivePipelines();

    }, this.POLL_INTERVAL_MS);
  }
  
  private stopPipelinePolling() {
    if (this.pipelinePoller) {
      clearInterval(this.pipelinePoller);
      this.pipelinePoller = null;
    }
  }
  
  private syncActivePipelines() {
    for (const [projectName, tracker] of this.activePipelines.entries()) {
      const row = this.dataSource.data.find(
        r => r.project_name === projectName
      );

      if (!row) continue;

      const status = (row.status || '').toLowerCase();

      // ✅ Finished → stop tracking
      if (['success', 'failed', 'canceled'].includes(status)) {
        this.activePipelines.delete(projectName);
        continue;
      }

      // Still running / pending
      tracker.status = status;
      tracker.lastUpdated = new Date();
    }

    // Safety stop
    if (this.activePipelines.size === 0) {
      this.stopPipelinePolling();
    }
  }

  private addActivePipeline(row: PipelineRow) {
    if (this.activePipelines.has(row.project_name)) {
      // console.warn(
      //   `Skipping ${row.project_name} — already triggered`
      // );
    }
    if (row?.status?.toLowerCase() === 'running' || row?.status?.toLowerCase() === 'pending'
      || row?.status?.toLowerCase() === 'created') {
      this.activePipelines.set(row.project_name, {
        scheduleId: row.matchedSchedule?.id || null,
        status: 'created',
        lastUpdated: new Date()
      });
    }

    console.log(this.activePipelines);
  }
}

