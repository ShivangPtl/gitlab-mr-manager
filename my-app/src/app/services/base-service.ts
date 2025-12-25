import { Injectable } from '@angular/core';
import { OnInit } from '@angular/core';
declare const window: any;
@Injectable({
  providedIn: 'root'
})
export class BaseService {
  private baseUrl = 'https://git.promptdairytech.com/api/v4';
  private get token(): string {
    return localStorage.getItem('token') ?? '';
  }

  private get headers(): HeadersInit {
    return {
      'PRIVATE-TOKEN': this.token
    };
  }

  async branchExists(projectId: number, branch: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/projects/${projectId}/repository/branches/${encodeURIComponent(branch)}`,
      { headers: this.headers }
    );
    return res.ok;
  }

  async getAhead(projectId: number, from: string, to: string): Promise<Response> {
    const res = await fetch(
      `${this.baseUrl}/projects/${projectId}/repository/compare` +
      `?from=${encodeURIComponent(from)}` +
      `&to=${encodeURIComponent(to)}`,
      { headers: this.headers }
    );
    return res;
  }
}
