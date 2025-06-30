import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

declare const window: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class Home implements OnInit {
  username = '';
  dropdownOpen = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    const { username } = await window.electronAPI.getToken();
    if (!username) {
      this.router.navigate(['/login']);
      return;
    }
    this.username = username;
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  async logout() {
    await window.electronAPI.clearToken();
    this.router.navigate(['/login']);
  }
}
