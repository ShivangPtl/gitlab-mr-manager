import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UserItem } from '../../models/user-item.model';
import { LabelItem } from '../../models/label-item.model';
import { ProjectSettingModel } from '../../models/project-settings.model';
import { Navbar } from '../../pages/navbar/navbar';

declare const window: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, Navbar ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class Home implements OnInit {
  gitlabApiBase = 'https://git.promptdairytech.com/api/v4';
  assignees: UserItem[] = [];
  reviewers: UserItem[] = [];
  labels: LabelItem[] = [];
  selectedAssigneeId: number = 119;
  selectedReviewerId: number = 119;
  mrTitle: string = '';
  mrDescription: string = '';


  filteredProjects: {
    project_id: number;
    project_name: string;
    local_repo_path: string;
    is_selected: boolean;
    current_branch: string;
    target_branch: string;
    commits_ahead: number;
  }[] = [];

  async ngOnInit() {
    const settings = await window.electronAPI.getSettings();

    this.assignees = [
      { user_id: 119, user_name: 'Shivang Patel' },
      { user_id: 120, user_name: 'Kiran Gami' },
      { user_id: 106, user_name: 'Ekta Gupta' },
      { user_id: 148, user_name: 'Jigisha Patel' }
    ];

    this.reviewers = [...this.assignees];

    this.labels = [
      { name: 'Task', is_selected: false },
      { name: 'Urgent', is_selected: false },
      { name: 'High', is_selected: false },
      { name: 'Feature', is_selected: false },
      { name: 'Bug', is_selected: false },
      { name: 'User Story', is_selected: false }
    ];

    if (settings.selectedAssigneeId) this.selectedAssigneeId = settings.selectedAssigneeId;
    if (settings.selectedReviewerId) this.selectedReviewerId = settings.selectedReviewerId;
    if (settings.labels) this.labels = settings.labels;

    const projects: ProjectSettingModel[] = settings.projects || [];
    const targetBranch: string = settings.defaultBranch || 'master_ah';

    const validProjects = projects.filter(p => p.is_selected && p.local_repo_path);

    for (const project of validProjects) {
      const current_branch = await this.runGit(project.local_repo_path, 'rev-parse --abbrev-ref HEAD');
      const commits_ahead_str = await this.runGit(
        project.local_repo_path,
        `rev-list --count origin/${targetBranch}..${current_branch}`
      );
      const commits_ahead = parseInt(commits_ahead_str || '0');

      this.filteredProjects.push({
        ...project,
        current_branch,
        target_branch: targetBranch,
        commits_ahead,
        is_selected: false
      });
    }
  }

  async runGit(path: string, command: string): Promise<string> {
    return await window.electronAPI.runGitCommand(path, command);
  }

  async createMergeRequests() {
    const selected = this.filteredProjects.filter(p => p.is_selected);
    if (!selected.length) {
      alert('Please select at least one project.');
      return;
    }

    const { token } = await window.electronAPI.getToken();
    if (!token) {
      alert('Missing GitLab token.');
      return;
    }

    const selectedLabels = this.labels.filter(l => l.is_selected).map(l => l.name).join(',');
    const results: { project: string, status: 'success' | 'failed', message: string }[] = [];
    for (const proj of selected) {
      try {
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
        formData.append('reviewer_ids[]', this.selectedReviewerId.toString());
        formData.append('labels', selectedLabels);
  
        // const response = await fetch(`${this.gitlabApiBase}/projects/${proj.project_id}/merge_requests`, {
        //   method: 'POST',
        //   headers: {
        //     'PRIVATE-TOKEN': token
        //   },
        //   body: formData.toString()
        // });

        const response = await fetch(`https://git.promptdairytech.com/api/v4/projects/${proj.project_id}/merge_requests`, {
          method: 'POST',
          headers: {
            'PRIVATE-TOKEN': token,
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
    }
  
    this.showMRResultsSummary(results);
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
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.length - success;
  
    let message = `✅ ${success} succeeded\n❌ ${failed} failed\n\n`;
  
    for (const r of results) {
      message += `${r.project}: ${r.status.toUpperCase()} - ${r.message}\n`;
    }
  
    alert(message);
  }
  
}
