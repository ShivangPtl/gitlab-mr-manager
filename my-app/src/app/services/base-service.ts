import { Injectable } from '@angular/core';

declare const window: any;

@Injectable({ providedIn: 'root' })
export class BaseService {
  readonly baseUrl = 'https://git.promptdairytech.com/api/v4';
  readonly graphqlUrl = 'https://git.promptdairytech.com/api/graphql';

  private _token: string = '';

  async getToken(): Promise<string> {
    if (!this._token) {
      const data = await window.electronAPI.getToken();
      this._token = data.token ?? '';
    }
    return this._token;
  }

  /** Call when the user logs out or changes token */
  clearTokenCache() {
    this._token = '';
  }

  private async headers(): Promise<HeadersInit> {
    return { 'PRIVATE-TOKEN': await this.getToken() };
  }

  async getAhead(projectId: number, from: string, to: string): Promise<Response> {
    return fetch(
      `${this.baseUrl}/projects/${projectId}/repository/compare` +
      `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: await this.headers() }
    );
  }

  async branchExists(projectId: number, branch: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/projects/${projectId}/repository/branches/${encodeURIComponent(branch)}`,
      { headers: await this.headers() }
    );
    return res.ok;
  }

  async graphql<T = any>(query: string): Promise<T> {
    const res = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        ...(await this.headers()),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    return (json.data ?? {}) as T;
  }


  async restGet(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: await this.headers()
    });
  }

  async restDelete(path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: await this.headers()
    });
  }

  async getCompare(projectId: number, from: string, to: string): Promise<Response> {
    return fetch(
      `${this.baseUrl}/projects/${projectId}/repository/compare` +
      `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: await this.headers() }
    );
  }

  async responseError(response: Response, fallback: string): Promise<string> {
    try {
      const text = await response.text();
      if (!text) return fallback;
      const json = JSON.parse(text);
      if (typeof json.message === 'string') return json.message;
      if (json.message && typeof json.message === 'object') return Object.values(json.message).flat().join(', ');
      return text;
    } catch {
      return fallback;
    }
  }

  async restPost(path: string, body: object): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...(await this.headers()),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  async restPostForm(path: string, form: URLSearchParams): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        ...(await this.headers()),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });
  }
}