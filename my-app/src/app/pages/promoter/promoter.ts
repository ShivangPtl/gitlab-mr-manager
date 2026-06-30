import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoaderService } from '../../services/loader';
import { Badge } from '../../components/badge/badge';

declare const window: any;

interface PromoteRow {
  id: string;
  displayName: string;
  type: 'API' | 'UI';
  is_selected: boolean;
  status: 'IDLE' | 'START' | 'RUN' | 'DONE' | 'FAILED';
  current: number;
  total: number;
  errorMessage?: string;
  showError?: boolean;
  finalPath?: string;
}

@Component({
  selector: 'app-promoter',
  standalone: true,
  templateUrl: './promoter.html',
  styleUrls: ['./promoter.scss'],
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatCheckboxModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule,
    MatSnackBarModule, Badge
  ]
})
export class Promoter implements OnInit, OnDestroy {
  username = '';
  password = '';
  isConnecting = false;
  isPromoting = false;
  servicesLoaded = false;
  hasRunStarted = false;
  rowsLocked = false; // true once a run has completed — checkboxes locked until Refresh

  apiDataSource = new MatTableDataSource<PromoteRow>();
  uiDataSource = new MatTableDataSource<PromoteRow>();
  columns = ['select', 'name', 'progress', 'status'];

  backupDir = '';
  private startTime: number | null = null;
  elapsedLabel = '';
  private elapsedInterval: any;


  private readonly serviceMap: Record<string, string> = {
    ahman: 'ahman.amulpashudhanapi.amulamcs.com',
    ahservice: 'ahservice.amulamcs.com',
    amulorg: 'amulorg.amulpashudhanapi.amulamcs.com',
    ahsupportqaapi: 'amulpashudhanapi.amulamcs.com',
    ahsupportqaauth: 'amulpashudhanauth.amulamcs.com',
    configman: 'configman.amulpashudhanapi.amulamcs.com',
    identity: 'identity.amulpashudhanapi.amulamcs.com',
    orgman: 'orgman.amulpashudhanapi.amulamcs.com',
    notification: 'notification.amulamcs.com'
  };

  private unsubscribeProgress?: () => void;

  constructor(
    private snackBar: MatSnackBar,
    private zone: NgZone,
    private loaderService: LoaderService
  ) {}

  async ngOnInit() {
    this.unsubscribeProgress = window.electronAPI.onPromoterProgress((progress: any) => {

      if (progress.type === 'status') {
        this.zone.run(() => {
          switch (progress.stage) {
            case 'checking-network':
              this.loaderService.showLoading('Connecting to network backup location…');
              break;
            case 'network-checked':
              this.loaderService.hide();
              if (progress.usedFallback) {
                this.snackBar.open('Network path unreachable — saving to Desktop instead', 'Close', {
                  duration: 4000, panelClass: ['error-snackbar']
                });
              }
              break;
            case 'connecting-api':
              this.loaderService.showLoading('Connecting to API server…');
              break;
            case 'connecting-ui':
              this.loaderService.showLoading('Connecting to UI server…');
              break;
            case 'connected-api':
            case 'connected-ui':
              this.loaderService.hide();
              break;
            case 'connect-failed':
              this.loaderService.hide();
              this.snackBar.open(`Connection failed: ${progress.message}`, 'Close', {
                duration: 6000, panelClass: ['error-snackbar']
              });
              break;
          }
        });
        return;
      }

      if (progress.type !== 'row') return;

      this.zone.run(() => {
        const list = progress.itemType === 'API' ? this.apiDataSource : this.uiDataSource;
        const row = list.data.find(r => r.id === progress.id);
        if (row) {
          row.status = progress.status;
          row.current = progress.current;
          row.total = progress.total;
          if (progress.errorMessage) row.errorMessage = progress.errorMessage;
          list.data = [...list.data];
        }
      });
    });

    await this.tryAutoConnect();
  }

  ngOnDestroy() {
    this.unsubscribeProgress?.();
    if (this.elapsedInterval) clearInterval(this.elapsedInterval);
  }

  /** On tab open: try stored credentials silently. Falls back to login form on failure. */
  private async tryAutoConnect() {
    const saved = await window.electronAPI.promoterGetCredentials();
    if (!saved?.username || !saved?.password) {
      return; // no saved creds — show login form, nothing to do
    }

    this.loaderService.showLoading('Connecting to QA server…');
    try {
      const result = await window.electronAPI.promoterListServices(saved);

      if (!result.success) {
        this.snackBar.open(`Saved credentials failed: ${result.message}. Please sign in again.`, 'Close', {
          duration: 5000, panelClass: ['error-snackbar']
        });
        await window.electronAPI.promoterClearCredentials();
        return;
      }

      this.username = saved.username;
      this.password = saved.password;
      this.populateServices(result);
    } catch (err: any) {
      this.snackBar.open(`Saved credentials failed: ${err.message}. Please sign in again.`, 'Close', {
        duration: 5000, panelClass: ['error-snackbar']
      });
      await window.electronAPI.promoterClearCredentials();
    } finally {
      this.loaderService.hide();
    }
  }

  async loadServices() {
    if (!this.username || !this.password) {
      this.snackBar.open('Enter username and password first', 'Close', { duration: 3000 });
      return;
    }

    this.isConnecting = true;
    this.loaderService.showLoading('Connecting to QA server…');
    try {
      const credentials = { username: this.username, password: this.password };
      const result = await window.electronAPI.promoterListServices(credentials);

      if (!result.success) {
        this.snackBar.open(`Connection failed: ${result.message}`, 'Close', {
          duration: 5000, panelClass: ['error-snackbar']
        });
        return;
      }

      // success — persist for next time the tab is opened
      await window.electronAPI.promoterSaveCredentials(credentials);
      this.populateServices(result);
    } catch (err: any) {
      this.snackBar.open(err.message || 'Failed to connect', 'Close', {
        duration: 5000, panelClass: ['error-snackbar']
      });
    } finally {
      this.isConnecting = false;
      this.loaderService.hide();
    }
  }

  private populateServices(result: any) {
    this.apiDataSource.data = result.services
      .map((s: string) => {
        const displayName = s.split('.')[0].toLowerCase();

        return {
          id: s,
          finalPath: this.serviceMap[displayName] ?? s,
          displayName,
          type: 'API' as const,
          is_selected: false,
          status: 'IDLE' as const,
          current: 0,
          total: 0
        };
      })
      .filter((service : any) =>
        !['notification', 'configdevice', 'logs'].includes(service.displayName)
      );

    this.uiDataSource.data = result.uiFolders.map((u: string) => ({
      id: u,
      finalPath: u,
      displayName: u.split('.')[0],
      type: 'UI' as const,
      is_selected: false,
      status: 'IDLE' as const,
      current: 0,
      total: 0
    }));

    this.servicesLoaded = true;
    this.hasRunStarted = false;
    this.rowsLocked = false;
    this.backupDir = '';
  }

  /** Refresh button — reconnects with current credentials and resets the table fully. */
  async refresh() {
    if (!this.username || !this.password) return;

    this.loaderService.showLoading('Refreshing services…');
    try {
      const result = await window.electronAPI.promoterListServices({
        username: this.username, password: this.password
      });

      if (!result.success) {
        this.snackBar.open(`Refresh failed: ${result.message}`, 'Close', {
          duration: 5000, panelClass: ['error-snackbar']
        });
        return;
      }

      this.populateServices(result);
    } catch (err: any) {
      this.snackBar.open(err.message || 'Refresh failed', 'Close', {
        duration: 5000, panelClass: ['error-snackbar']
      });
    } finally {
      this.loaderService.hide();
    }
  }

  isAnySelected(): boolean {
    return this.apiDataSource.data.some(r => r.is_selected) ||
           this.uiDataSource.data.some(r => r.is_selected);
  }

  // ---- Visible rows: once run starts, ONLY show selected items, no toggle back ----
  get visibleApiRows(): PromoteRow[] {
    return this.hasRunStarted
      ? this.apiDataSource.data.filter(r => r.is_selected)
      : this.apiDataSource.data;
  }

  get visibleUiRows(): PromoteRow[] {
    return this.hasRunStarted
      ? this.uiDataSource.data.filter(r => r.is_selected)
      : this.uiDataSource.data;
  }

  get apiSelectedCount(): number {
    return this.apiDataSource.data.filter(r => r.is_selected).length;
  }

  get uiSelectedCount(): number {
    return this.uiDataSource.data.filter(r => r.is_selected).length;
  }

  private get allRows(): PromoteRow[] {
    return [...this.apiDataSource.data, ...this.uiDataSource.data];
  }

  get selectedCount(): number {
    return this.allRows.filter(r => r.is_selected).length;
  }

  get doneCount(): number {
    return this.allRows.filter(r => r.is_selected && r.status === 'DONE').length;
  }

  get failedCount(): number {
    return this.allRows.filter(r => r.is_selected && r.status === 'FAILED').length;
  }

  get totalFilesCopied(): number {
    return this.allRows
      .filter(r => r.is_selected && r.status === 'DONE')
      .reduce((sum, r) => sum + r.total, 0);
  }

  async runBackup() {
    const selected = [
      ...this.apiDataSource.data.filter(r => r.is_selected),
      ...this.uiDataSource.data.filter(r => r.is_selected)
    ];
    if (!selected.length) return;

    this.isPromoting = true;
    this.hasRunStarted = true;
    this.rowsLocked = true;
    this.startElapsedTimer();

    this.apiDataSource.data = this.apiDataSource.data.map(r =>
      r.is_selected ? { ...r, status: 'IDLE' as const, current: 0, total: 0, errorMessage: undefined, showError: false } : r
    );
    this.uiDataSource.data = this.uiDataSource.data.map(r =>
      r.is_selected ? { ...r, status: 'IDLE' as const, current: 0, total: 0, errorMessage: undefined, showError: false } : r
    );

    try {
      const result = await window.electronAPI.promoterBackup(
        { username: this.username, password: this.password },
        selected.map(r => ({ type: r.type, name: r.id, finalPath: r.finalPath }))
      );

      if (!result.success) {
        this.snackBar.open(`Backup failed: ${result.message}`, 'Close', {
          duration: 6000, panelClass: ['error-snackbar']
        });
        return;
      }

      this.backupDir = result.exportDir;

      for (const r of result.results) {
        if (r.status === 'failed') {
          const list = r.type === 'API' ? this.apiDataSource : this.uiDataSource;
          const row = list.data.find(x => x.id === r.name);
          if (row) row.errorMessage = r.message;
        }
      }

      const successes = result.results.filter((r: any) => r.status === 'success');
      const failures = result.results.filter((r: any) => r.status === 'failed');
      const locationNote = result.usedFallback ? ' (network unreachable — saved to Desktop instead)' : '';

      if (successes.length) {
        this.snackBar.open(`✅ Backed up ${successes.length} item(s)${locationNote}`, 'Close', {
          duration: 5000, panelClass: ['success-snackbar']
        });
      }
      if (failures.length) {
        this.snackBar.open(`❌ ${failures.length} failed — click the info icon next to FAILED for details`, 'Close', {
          duration: 6000, panelClass: ['error-snackbar']
        });
      }
    } finally {
      this.isPromoting = false;
      this.stopElapsedTimer();
    }
  }

  private startElapsedTimer() {
    this.startTime = Date.now();
    this.elapsedInterval = setInterval(() => {
      if (!this.startTime) return;
      const secs = Math.floor((Date.now() - this.startTime) / 1000);
      this.elapsedLabel = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
    }, 1000);
  }

  private stopElapsedTimer() {
    if (this.elapsedInterval) clearInterval(this.elapsedInterval);
  }

  openBackupFolder() {
    window.electronAPI.openExternal(this.backupDir);
  }

  getProgressPercent(row: PromoteRow): number {
    if (!row.total) return 0;
    return Math.round((row.current / row.total) * 100);
  }

  getStatusType(status: string): string {
    switch (status) {
      case 'DONE': return 'success';
      case 'FAILED': return 'error';
      case 'RUN': return 'pending';
      default: return 'neutral';
    }
  }
}