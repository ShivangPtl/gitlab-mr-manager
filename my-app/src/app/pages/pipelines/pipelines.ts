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

  ],
})
export class Pipelines implements OnInit {
  constructor(
    private loader: LoaderService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  columns = ['project', 'type', 'status', 'user', 'created', 'info'];
  dataSource = new MatTableDataSource<PipelineRow>();
  lastRefreshed: Date | null = null;

  async ngOnInit() {
    await this.refreshPipelines();
  }

  async refreshPipelines() {
    try {
      this.loader.showLoading('Fetching pipelines…');
      const settings = await window.electronAPI.getSettings();
      const selectedProjects = settings.projects;
      const branch = settings.defaultBranch || 'master_ah';

      const rows: PipelineRow[] = [];

      for (const proj of selectedProjects) {
        const pipelines = await this.fetchPipelines(proj.project_name, branch);

        let goodPipeline: any = null;
        const pendingPipelines: any[] = [];

        for (const p of pipelines) {
          const status = p.status?.toLowerCase();
          if (!goodPipeline && ['running', 'success', 'failed', 'canceled'].includes(status)) {
            goodPipeline = p;
          }
          if (['pending', 'created'].includes(status)) {
            pendingPipelines.push(p);
          }
        }

        if (goodPipeline) {
          rows.push(this.toRow(proj.project_name, 'Latest', goodPipeline));
        }
        for (const p of pendingPipelines) {
          rows.push(this.toRow(proj.project_name, 'Pending/Created', p));
        }
      }

      this.dataSource.data = rows;
      this.lastRefreshed = new Date();

      this.loader.hide();
    } catch (err) {
      this.loader.hide();
      this.showError(err);
    }
  }

  toRow(projectName: string, type: string, pipeline: any): PipelineRow {
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
      link: `https://git.promptdairytech.com/pdp/${projectName}/-/pipeline_schedules`
    };
  }

  async fetchPipelines(projectName: string, branch: string): Promise<any[]> {
    const token = (await window.electronAPI.getToken()).token;
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
        'PRIVATE-TOKEN': token,
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

formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
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
}

