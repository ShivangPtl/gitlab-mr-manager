import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GitlabAuth } from '../../services/gitlab-auth';

declare const window: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login {
  accessToken = '';
  error = '';

  constructor(private router: Router, private authService: GitlabAuth) {}

  async onSubmit() {
    this.error = '';
    if (!this.accessToken) return;

    const result = await this.authService.validateToken(this.accessToken);

    if (result.success && result.username) {
      await window.electronAPI.saveToken(this.accessToken, result.username, result.isAdmin);
      localStorage.setItem('token', this.accessToken);
      this.router.navigate(['/home']);
    } else {
      this.error = 'Invalid GitLab token. Please try again.';
    }
  }
}
