import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UserItem } from '../models/user-item.model';

@Injectable({ providedIn: 'root' })
export class GitlabAuth {
  constructor(private http: HttpClient) {}
  gitlabUrl = 'https://git.promptdairytech.com/api/v4';

  userList: UserItem[] = [
    { user_id: 119, user_name: 'Shivang Patel' },
    { user_id: 120, user_name: 'Kiran Gami' },
    { user_id: 106, user_name: 'Ekta Gupta' },
    { user_id: 148, user_name: 'Jigisha Patel' },
  ];

  async validateToken(token: string): Promise<{ success: boolean; username?: string; isAdmin?: boolean }> {
    try {
      const headers = new HttpHeaders({ 'PRIVATE-TOKEN': token });

      // Call GitLab API to fetch the authenticated user's profile
      const user = await firstValueFrom(
        this.http.get<any>(this.gitlabUrl + '/user', { headers })
      );

      const isAdmin = this.userList.some(u => u.user_name === user.name);

      return { success: true, username: user.name, isAdmin: isAdmin };
    } catch (error) {
      return { success: false, isAdmin: false };
    }
  }
}
