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
    'status',
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
    'Kulashree Patil',
    'Jaimin Vasveliya',
    'Divyesh Nankar',
    'Ankita Hirani'
  ];

  customSettings?: CustomSettings;
  getProjectType = getProjectType;

  constructor(private loader: LoaderService) { }

  async ngOnInit(): Promise<void> {
    this.customSettings = await window.electronAPI.getSettings();
    await this.refreshMRs();
  }

  // async refreshMRs(): Promise<void> {
  //   try {
  //     this.loader.showLoading('Fetching merge requests…');

  //     const selectedUsers = this.users;

  //     if (!this.customSettings?.projects?.length) {
  //       this.dataSource.data = [];
  //       this.lastRefreshed = new Date();
  //       return;
  //     }

  //     const branches = this.getBranches(this.customSettings);
  //     const projects = this.customSettings.projects.filter((p: any) => p.is_selected);

  //     const tasks: Promise<MRTableRow[]>[] = [];

  //     for (const proj of projects) {
  //       for (const branch of branches) {
  //         tasks.push(
  //           this.processProjectBranchMRs(
  //             proj,
  //             branch,
  //             selectedUsers
  //           )
  //         );
  //       }
  //     }

  //     // 🔥 PARALLEL EXECUTION
  //     const results = await Promise.all(tasks);

  //     this.dataSource.data = results.flat();
  //     this.lastRefreshed = new Date();

  //   } catch (err) {
  //     // this.showError(err);
  //   } finally {
  //     this.loader.hide();
  //   }
  // }


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

      // Filter by selected users
      const rows: MRTableRow[] = allMergeRequests
        .filter(mr => {
          const assignee = mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-';
          return selectedUsers.includes(mr.author?.name) || selectedUsers.includes(assignee);
        })
        .map(mr => ({
          project_name: mr.projectName,
          source_branch: mr.sourceBranch,
          target_branch: mr.targetBranch,
          author: mr.author.name,
          assignee: mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-',
          created_at: new Date(mr.createdAt).toLocaleString('en-GB'),
          status: mr.state === 'opened' ? 'PENDING' : mr.state.toUpperCase(),
          url: mr.webUrl
        }));

      this.dataSource.data = rows;
      this.lastRefreshed = new Date();

    } catch (err) {
      console.error(err);
    } finally {
      this.loader.hide();
    }
  }


  // private async processProjectBranchMRs(
  //   proj: any,
  //   branch: string,
  //   selectedUsers: string[]
  // ): Promise<MRTableRow[]> {

  //   const rows: MRTableRow[] = [];

  //   const mrList = await this.fetchMergeRequests(
  //     proj.project_name,
  //     branch
  //   );

  //   for (const mr of mrList) {
  //     const assignee =
  //       mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-';

  //     const match =
  //       selectedUsers.includes(assignee) ||
  //       selectedUsers.includes(mr.author?.name);

  //     if (!match) continue;

  //     rows.push({
  //       project_name: proj.project_name,
  //       source_branch: mr.sourceBranch,
  //       target_branch: mr.targetBranch,
  //       author: mr.author.name,
  //       assignee,
  //       created_at: new Date(mr.createdAt).toLocaleString('en-GB'),
  //       status: mr.state == 'opened' ? 'PENDING' : mr.state.toUpperCase(),
  //       url: mr.webUrl
  //     });
  //   }

  //   return rows;
  // }
  


  // async fetchMergeRequests(projectName: string, targetBranch: string): Promise<any[]> {
  //   const token = (await window.electronAPI.getToken()).token;

  //   const query = `
  //   {
  //     group(fullPath: "pdp") {
  //       projects(first: 5, search: "${projectName}") {
  //         nodes {
  //           mergeRequests(
  //             state: opened,
  //             targetBranches: ["${targetBranch}"],
  //             sort: CREATED_DESC
  //           ) {
  //             nodes {
  //               title
  //               webUrl
  //               sourceBranch
  //               targetBranch
  //               state
  //               author { name }
  //               assignees { nodes { name } }
  //               createdAt
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }`;


  //   const response = await fetch('https://git.promptdairytech.com/api/graphql', {
  //     method: 'POST',
  //     headers: {
  //       'PRIVATE-TOKEN': token,
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({ query })
  //   });

  //   const json = await response.json();
  //   // return json?.data?.group?.projects?.nodes?.[0]?.mergeRequests?.nodes || [];
  //   const projects = json?.data?.group?.projects?.nodes ?? [];

  //   const allMergeRequests = projects.flatMap(
  //     (p:any) => p.mergeRequests?.nodes ?? []
  //   );

  //   return allMergeRequests;
  // }

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
                webUrl
                sourceBranch
                targetBranch
                state
                author { name }
                createdAt
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
}
