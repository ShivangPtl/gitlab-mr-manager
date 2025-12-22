import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LoaderService } from '../../services/loader';
import { Navbar } from '../navbar/navbar';

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
    MatIconModule
  ]
})
export class MergeRequests implements OnInit {

  displayColumns = [
    'project',
    'source',
    'target',
    'author',
    'assignee',
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

  constructor(private loader: LoaderService) { }

  async ngOnInit(): Promise<void> {
    await this.refreshMRs();
  }

  async refreshMRs(): Promise<void> {
    this.loader.showLoading('Fetching merge requests…');

    const settings = await window.electronAPI.getSettings();
    const targetBranch = settings.defaultBranch || 'master_ah';
    const selectedUsers = this.users;

    const output: MRTableRow[] = [];

    if(settings.projects == undefined || settings.projects.length === 0) {
      this.dataSource.data = [];
      this.lastRefreshed = new Date();
      this.loader.hide();
      return;
    }

    for (const proj of settings.projects) {
      if (!proj.is_selected) continue;

      const mrList = await this.fetchMergeRequests(proj.project_name, targetBranch);

      for (const mr of mrList) {
        const assignee = mr.assignees?.nodes?.map((x: any) => x.name).join(', ') ?? '-';

        const match =
          selectedUsers.includes(assignee) ||
          selectedUsers.includes(mr.author.name);

        if (!match) continue;

        output.push({
          project_name: proj.project_name,
          source_branch: mr.sourceBranch,
          target_branch: mr.targetBranch,
          author: mr.author.name,
          assignee,
          created_at: new Date(mr.createdAt).toLocaleString('en-GB'),
          status: mr.state.toUpperCase(),
          url: mr.webUrl
        });
      }
    }

    this.dataSource.data = output;
    this.lastRefreshed = new Date();
    this.loader.hide();
  }


  async fetchMergeRequests(projectName: string, targetBranch: string): Promise<any[]> {
    const token = (await window.electronAPI.getToken()).token;

    const query = `
    {
      group(fullPath: "pdp") {
        projects(first: 1, search: "${projectName}") {
          nodes {
            mergeRequests(
              state: opened,
              targetBranches: ["${targetBranch}"],
              sort: CREATED_DESC
            ) {
              nodes {
                title
                webUrl
                sourceBranch
                targetBranch
                state
                author { name }
                assignees { nodes { name } }
                createdAt
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
    return json?.data?.group?.projects?.nodes?.[0]?.mergeRequests?.nodes || [];
  }

  openDefaultBrowser(url: string) {
    window.electronAPI.openExternal(url);
  }
}
