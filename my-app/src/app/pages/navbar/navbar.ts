import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { MatTabLabel } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

declare const window: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
  standalone: true,
  imports: [MatTabGroup, MatTabLabel, MatButtonModule, MatTabsModule, MatIconModule, CommonModule]
})
export class Navbar {
  selectedTabIndex = 0;
  userName = '';
  token: string = '';
  isAdmin = false;

  tabs: { label: string; route: string; matIcon: string; adminOnly?: boolean }[] = [
    { label: 'Home',           route: '/home',             matIcon: 'home' },
    { label: 'Merge Requests', route: '/merge-requests',   matIcon: 'merge' },
    { label: 'Pipelines',      route: '/pipelines',        matIcon: 'rocket_launch' },
    { label: 'Create Branch',  route: '/create-branch',    matIcon: 'account_tree', adminOnly: true },
    { label: 'Compare',        route: '/compare-branches', matIcon: 'compare_arrows', adminOnly: true },
    { label: 'Backup',        route: '/promoter',         matIcon: 'download', adminOnly: true },  // NEW
    { label: 'Settings',       route: '/settings',         matIcon: 'settings' },
  ];

  constructor(private router: Router) {}

  async ngOnInit() {
    const tokenData = await window.electronAPI.getToken();
    this.token      = tokenData.token;
    this.userName   = tokenData.username;
    this.isAdmin    = tokenData.isAdmin;
    this.setInitialTab();
  }

  onTabChange(index: number) {
    const tab = this.tabsVisible[index];
    if (tab) this.goTo(tab.route);
  }

  goTo(route: string) {
    this.router.navigate([route]);
  }

  async logout() {
    await window.electronAPI.clearToken();
    this.router.navigate(['/login']);
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