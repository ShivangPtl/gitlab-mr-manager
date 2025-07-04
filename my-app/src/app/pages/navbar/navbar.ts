import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { MatTabLabel } from '@angular/material/tabs';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

declare const window: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
  standalone: true,
  imports: [MatTabGroup, MatTabLabel, MatButtonModule, MatTabsModule]
})
export class Navbar {
  selectedTabIndex = 0;
  userName = '';

  token: string = '';

  constructor(private router: Router) {
    
  }
 

  async ngOnInit() {
    const tokenData = await window.electronAPI.getToken();
    this.token = tokenData.token;
    this.userName = tokenData.username;
    // Set initial tab based on current route
    this.setInitialTab();
  }

  onTabChange(index: number) {
    this.selectedTabIndex = index;
    
    // Navigate based on selected tab
    if (index === 0) {
      this.goTo('/home');
    } else if (index === 1) {
      this.goTo('/settings');
    }
  }

  goTo(route: string) {
    this.router.navigate([route]);
  }

  async logout() {
    // Implement logout logic
    console.log('Logging out...');

    await window.electronAPI.clearToken();
    this.router.navigate(['/login']);
    // Clear authentication, redirect to login, etc.
  }

  private setInitialTab() {
    // Set tab based on current route
    const currentUrl = this.router.url;
    if (currentUrl.includes('/settings')) {
      this.selectedTabIndex = 1;
    } else {
      this.selectedTabIndex = 0; // Default to Home
    }
  }
}