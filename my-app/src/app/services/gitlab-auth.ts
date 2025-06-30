import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GitlabAuth {
  constructor(private http: HttpClient) {}
  gitlabUrl = 'https://git.promptdairytech.com/api/v4';

  async validateToken(token: string): Promise<{ success: boolean; username?: string }> {
    try {
      const headers = new HttpHeaders({ 'PRIVATE-TOKEN': token });

      // Call GitLab API to fetch the authenticated user's profile
      const user = await firstValueFrom(
        this.http.get<any>(this.gitlabUrl + '/user', { headers })
      );

      return { success: true, username: user.name };
    } catch (error) {
      return { success: false };
    }
  }
}
