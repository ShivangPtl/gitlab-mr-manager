import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { MatTabLabel } from '@angular/material/tabs';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { UserItem } from '../../models/user-item.model';
import { CommonModule } from '@angular/common';

declare const window: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
  standalone: true,
  imports: [MatTabGroup, MatTabLabel, MatButtonModule, MatTabsModule, CommonModule]
})
export class Navbar {
  selectedTabIndex = 0;
  userName = '';

  token: string = '';

  isAdmin = false;
  tabs: { label: string; route: string; icon: string; adminOnly?: boolean }[] = [
    { label: "Home", route: "/home", icon: "🏠" },
    { label: "Merge Requests", route: "/merge-requests", icon: "🔀" },
    { label: "Pipelines", route: "/pipelines", icon: "🚧" },
    { label: "Create Branch", route: "/create-branch", icon: "🛠️", adminOnly: true },
    { label: "Compare Branch", route: "/compare-branches", icon: "↔️", adminOnly: true },
    { label: "Settings", route: "/settings", icon: "⚙️" }
  ];


  constructor(private router: Router) {
    
  }
 

  async ngOnInit() {
    const settings = await window.electronAPI.getSettings();
    const tokenData = await window.electronAPI.getToken();
    this.token = tokenData.token;
    this.userName = tokenData.username;
    this.isAdmin = tokenData.isAdmin;
    // Set initial tab based on current route

    const adminList: UserItem[] = settings.adminList ?? [];

    //this.isAdmin = adminList.some(u => u.user_name === tokenData.username);

    this.setInitialTab();
  }

  // onTabChange(index: number) {
  //   this.selectedTabIndex = index;
    
  //   // Navigate based on selected tab
  //   if (index === 0) {
  //     this.goTo('/home');
  //   } else if (index === 1) {
  //     this.goTo('/merge-requests');
  //   } else if (index === 2) {
  //     this.goTo('/pipelines');
  //   } else if (index === 3) {
  //     this.goTo('/create-branch');
  //   } else if (index === 4) {
  //     this.goTo('/settings');
  //   }
  // }

  onTabChange(index: number) {
    const tab = this.tabsVisible[index];
    if (tab) this.goTo(tab.route);
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
    const currentUrl = this.router.url;

    const index = this.tabsVisible.findIndex(t => currentUrl.includes(t.route));
    this.selectedTabIndex = index >= 0 ? index : 0;
  }


  get tabsVisible() {
    return this.tabs.filter(t => !t.adminOnly || this.isAdmin);
  }
}
