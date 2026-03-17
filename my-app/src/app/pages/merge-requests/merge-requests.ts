import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LoaderService } from '../../services/loader';
import { Navbar } from '../navbar/navbar';
import { Badge } from "../../components/badge/badge";
import { CustomSettings } from '../settings/settings';
import { getProjectType } from '../../../shared/base';
import { MatDialog } from '@angular/material/dialog';
import { MRReviewSelectionDialog } from '../compare-branches/mr-review-selection-dialog/mr-review-selection-dialog';
import { BaseService } from '../../services/base-service';
import { AiService } from '../../services/ai-mr';
import { MatSnackBar } from '@angular/material/snack-bar';

declare const window: any;

interface MRTableRow {
  project_name: string;
  source_branch: string;
  target_branch: string;
  author: string;
  assignee: string;
  created_at: string;
  status: string;
  url: string;

  project_id: number;
  iid: number;

  diffRefs: {
    baseSha: string;
    headSha: string;
    startSha: string;
  },

  thread_total: number;
  thread_resolved: number;
  thread_pending: number;
  mergeable: boolean;

  approval_status: boolean;
  merge_status: string;
}

@Component({
  selector: 'app-merge-requests',
  standalone: true,
  templateUrl: './merge-requests.html',
  styleUrl: './merge-requests.scss',
  imports: [
    CommonModule,
    Navbar,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    Badge
  ]
})
export class MergeRequests implements OnInit {

  displayColumns = [
    'project',
    'source',
    'target',
    'author',
    'created',
    // 'review_status',
    'ai_review',
    'ai_action',
    'url'
  ];

  dataSource = new MatTableDataSource<MRTableRow>();
  lastRefreshed: Date | null = null;

  users = [
    'Shivang Patel',
    'Kiran Gami',
    'Ekta Gupta',
    'Aman Gupta',
    'Dhriti Patel',
    'Kulashree Patil1',
    'Jaimin Vasveliya',
    'Divyesh Nankar',
    'Ankita Hirani'
  ];

  customSettings?: CustomSettings;
  getProjectType = getProjectType;

  constructor(private loader: LoaderService, private dialog: MatDialog, private baseService: BaseService, private aiService: AiService,
    private snackBar: MatSnackBar
  ) { }

  async ngOnInit(): Promise<void> {
    this.customSettings = await window.electronAPI.getSettings();

    const tokenData = await window.electronAPI.getToken();
    const isAdmin = tokenData.isAdmin;

    if (isAdmin) {
      this.displayColumns = ['project', 'source', 'target', 'author', 'created', 'ai_review', 'ai_action', 'url'];
    } else {
      this.displayColumns = ['project', 'source', 'target', 'author', 'created', 'ai_review', 'url'];
    }

    await this.refreshMRs();
  }

  async refreshMRs(): Promise<void> {
    try {
      this.loader.showLoading('Fetching merge requests…');

      const selectedUsers = this.users;

      if (!this.customSettings?.projects?.length) {
        this.dataSource.data = [];
        this.lastRefreshed = new Date();
        return;
      }

      const branches = this.getBranches(this.customSettings);
      const projects = this.customSettings.projects.filter((p: any) => p.is_selected);

      // 🔥 Optimized: fetch all projects & branches in a single call
      const allMergeRequests = await this.fetchMergeRequests(projects.map(p => p.project_name), branches);
      const projectIdMap = new Map(
        projects.map(p => [p.project_name, p.project_id])
      );
      // Filter by selected users
      const rows: MRTableRow[] = allMergeRequests
        .filter(mr => {
          const assignee = mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-';

          const validUser = selectedUsers.includes(mr.author?.name) || selectedUsers.includes(assignee);

          const projectId = projectIdMap.get(mr.projectName);

          return validUser && projectId !== undefined;   // ✅ IMPORTANT
        })
        .map(mr => {

          const projectId = projectIdMap.get(mr.projectName)!;  // 🔥 NON-NULL ASSERTION

          return {
            project_name: mr.projectName,
            source_branch: mr.sourceBranch,
            target_branch: mr.targetBranch,
            author: mr.author.name,
            assignee: mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-',
            created_at: new Date(mr.createdAt).toLocaleString('en-GB'),
            status: mr.state === 'opened' ? 'PENDING' : mr.state.toUpperCase(),
            url: mr.webUrl,

            iid: mr.iid,
            project_id: projectId,   // ✅ always number now

            diffRefs: mr.diffRefs,

            thread_total: 0,
            thread_pending: 0,
            thread_resolved: 0,
            mergeable: true,

            approval_status: mr.approved ?? false,
            merge_status: mr.mergeStatus
          };

        });

      await Promise.all(
        rows.map(async (row) => {

          const review = await this.getReviewCounts(row);

          row.thread_total = review.total;
          row.thread_resolved = review.resolved;
          row.thread_pending = review.pending;
          row.mergeable = review.mergeable;

        })
      );

      this.dataSource.data = rows;
      this.lastRefreshed = new Date();

    } catch (err) {
      console.error(err);
    } finally {
      this.loader.hide();
    }
  }

  async fetchMergeRequests(projectNames: string[], branches: string[]): Promise<any[]> {
    const token = (await window.electronAPI.getToken()).token;

    // Prepare GraphQL aliases for each project
    const queries = projectNames
      .map(p => {
        const alias = p.replace(/[.-]/g, '_'); // GraphQL alias cannot have dot or dash
        const branchList = branches.map(b => `"${b}"`).join(', ');
        return `
          ${alias}: project(fullPath: "pdp/${p}") {
            name
            mergeRequests(state: opened, targetBranches: [${branchList}], sort: CREATED_DESC) {
              nodes {
                iid
                webUrl
                sourceBranch
                targetBranch
                state
                author { name }
                createdAt

                diffRefs {
                  baseSha
                  headSha
                  startSha
                }        
              }
            }
          }
        `;
      })
      .join('\n');

    const query = `{ ${queries} }`;

    // Fetch from GitLab GraphQL
    const res = await fetch('https://git.promptdairytech.com/api/graphql', {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const json = await res.json();
    const data = json?.data || {};

    // Flatten all merge requests and attach projectName
    const allMergeRequests: any[] = [];
    for (const key in data) {
      const project = data[key];
      if (project?.mergeRequests?.nodes) {
        allMergeRequests.push(
          ...project.mergeRequests.nodes.map((mr: any) => ({
            ...mr,
            projectName: project.name
          }))
        );
      }
    }

    return allMergeRequests;
  }



  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }

  private getBranches(settings: any): string[] {
    return [
      settings.supportBranch,
      settings.releaseBranch,
      settings.liveBranch
    ].filter(Boolean); // removes undefined/null
  }

  get hasSelectedProject(): boolean {
    return this.customSettings?.projects?.some(p => p.is_selected) ?? false;
  }

  getBranchType(branch: string): 'support' | 'release' | 'live' | '' {
    const settings = this.customSettings;
    if (!settings) return 'support';

    if (branch === settings.supportBranch) return 'support';
    if (branch === settings.releaseBranch) return 'release';
    if (branch === settings.liveBranch) return 'live';

    return '';
  }


  async runAIReview(mr: any) {
  try{
    this.loader.showLoading('AI Review in progress...');
    // 1️⃣ GET COMPARE DIFF
    const diffRes = await this.getMRCompareDiff(mr);

    const json = await diffRes.json();

    // 2️⃣ EXTRACT ONLY RISKY LINES
    const reviewInput = json.diffs
      .map((d: any) => {

        const riskyLines = d.diff
          .split('\n')
          .filter((l: string) =>
            l.startsWith('+') &&
            !l.startsWith('+++'))
          //.slice(0, 15)
          .join('\n');

        return `
Project:${mr.project_name}
File:${d.new_path}
Diff:
${riskyLines}
-----
`;
      })
      .join('\n');


    // 3️⃣ CALL AI
    const res = await this.aiService.generateMRReview({
      reviewInput: reviewInput
    });

    if (!res.success) {
      this.loader.hide();
      const errorMsg = this.parseError(res.error);
      
      this.snackBar.open(errorMsg, 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['error-snackbar']
      });
      return;
    };


    const parsed = JSON.parse(res.description);

    const findings =
      (parsed.findings ?? [])
        .map((x: any) => ({
          ...x,
          selected: false
        }));

    if(!findings || findings.length === 0) {
      this.loader.hide();
      this.snackBar.open('No risky code detected.', 'Close', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['info-snackbar']
      });
      return;
    }

    // 5️⃣ OPEN DIALOG
    const dialogRef =
      this.dialog.open(
        MRReviewSelectionDialog,
        {
          width: '700px',
          data: {
            project: mr.project_name,
            findings,
            diffRefs: mr.diffRefs,
            projectId: mr.project_id,
            iid: mr.iid
          }
        });


    // 6️⃣ ADD SELECTED AS MR THREAD COMMENTS
    dialogRef.afterClosed()
      .subscribe(async (selected) => {

        if (!selected?.length) return;

        await this.addCommentsToMR(
          mr,
          selected);

      });
    } catch (error) {
      console.error('Error running AI review:', error);
    } finally {
      this.loader.hide();
    }

  }

  async getMRCompareDiff(mr: any) {

    const token =
      (await window.electronAPI.getToken()).token;

    return fetch(
      `https://git.promptdairytech.com/api/v4/projects/${mr.project_id}/repository/compare?from=${mr.diffRefs.baseSha}&to=${mr.diffRefs.headSha}`,
      {
        headers: {
          'PRIVATE-TOKEN': token
        }
      });

  }

  async addCommentsToMR(mr: any, notes: any[]) {

    const token = (await window.electronAPI.getToken()).token;

    const json = await this.getMRChanges(mr.project_id, mr.iid);

    // const json = await diffRes.json();

    for (const n of notes) {

      const file =
        json.changes.find((c: any) =>
          c.new_path === n.file);

      if (!file) continue;

      const line =
        this.findLineNumber(file.diff, n.line);

      if (!line) continue;

      const lineCode =
        this.generateLineCode(
          mr.diffRefs.headSha,
          line);

      await fetch(
        `https://git.promptdairytech.com/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/discussions`,
        {
          method: 'POST',
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            body: `🤖 AI Review:\n${n.comment}`,
            position: {
              position_type: 'text',
              base_sha: mr.diffRefs.baseSha,
              start_sha: mr.diffRefs.startSha,
              head_sha: mr.diffRefs.headSha,
              new_path: n.file,
              new_line: line,
              line_code: lineCode
            }
          })
        });
    }
  }

  findLineNumber(diff: string, targetLine: string) {

    let newLine = 0;

    const lines = diff.split('\n');

    for (const l of lines) {

      if (l.startsWith('@@')) {

        const match = l.match(/\+(\d+)/);

        if (match)
          newLine = parseInt(match[1]);

        continue;
      }

      if (l.startsWith('+')) {

        if (l.includes(targetLine.trim()))
          return newLine;

        newLine++;
      }
      else if (!l.startsWith('-')) {
        newLine++;
      }
    }

    return null;
  }

  generateLineCode(headSha: string, newLine: number) {
    return `${headSha}_0_${newLine}`;
  }

  async getMRChanges(projectId: number, iid: number) {

    const token = (await window.electronAPI.getToken()).token;

    const res = await fetch(
      `https://git.promptdairytech.com/api/v4/projects/${projectId}/merge_requests/${iid}/changes`,
      {
        headers: { 'PRIVATE-TOKEN': token }
      });

    return res.json();
  }

  async getMRDiscussions(projectId: number, iid: number) {

    const token = (await window.electronAPI.getToken()).token;

    return fetch(
      `https://git.promptdairytech.com/api/v4/projects/${projectId}/merge_requests/${iid}/discussions`,
      {
        headers: {
          'PRIVATE-TOKEN': token
        }
      });
  }

  async getReviewCounts(mr: any) {

    const res = await this.getMRDiscussions(mr.project_id, mr.iid);

    const discussions = await res.json();

    const reviewThreads = discussions.filter(
      (d: any) =>
        d.notes?.length &&
        d.notes[0].resolvable === true
    );

    const resolvedThreads = discussions.filter(
      (d: any) =>
        d.notes?.length &&
        d.notes[0].resolvable === true && d.notes[0].resolved === true
    );

    const total = reviewThreads.length;

    const resolved = resolvedThreads.length;

    const pending = total - resolved;

    return {
      total,
      resolved,
      pending,
      mergeable: pending === 0
    };
  }

  // getReviewStatus(row: any) {

  //   if (row.approval_status)
  //     return 'ready';

  //   if (row.thread_total === 0)
  //     return 'review_pending';

  //   if (row.thread_pending > 0)
  //     return 'correction_pending';

  //   return 'review_done';
  // }

  getReviewStatus(row: any): { label: string, type: string } {

    // ✅ MR Approved → Ready to merge
    if (row.approval_status) {
      return { label: 'APPROVED', type: 'review_approved' };
    }

    // ❌ No review yet
    if (row.thread_total === 0) {
      return { label: 'PENDING', type: 'review_pending' };
    }

    // ⚠️ Review done but corrections pending
    if (row.thread_pending > 0) {
      return { label: 'FIX REQUIRED', type: 'review_fix' };
    }

    // ✅ Review done + all threads resolved
    return { label: 'REVIEWED', type: 'review_ready' };
  }

  getAIAction(row: any) {

    if (row.approval_status)
      return {
        text: 'Approved',
        icon: 'verified',
        type: 'approved'
      };

    if (row.thread_total === 0)
      return {
        text: 'Review',
        icon: 'smart_toy',
        type: 'review'
      };

    if (row.thread_pending > 0)
      return {
        text: 'Fix',
        icon: 'build',
        type: 'fix'
      };

    return {
      text: 'Reviewed',
      icon: 'check_circle',
      type: 'reviewed'
    };
  }

  parseError(error: any): string {
    try {
      if (typeof error === 'string') {
        // remove "401 " prefix if exists
        const jsonStart = error.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(error.substring(jsonStart));
          return parsed?.error?.message || error;
        }
      }

      return error?.message || error || 'Unknown error';
    } catch {
      return error;
    }
  }
}
