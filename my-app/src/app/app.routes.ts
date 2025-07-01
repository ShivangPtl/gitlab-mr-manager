import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'home', component: Home },
  { path: 'settings', component: Settings },
  { path: '**', redirectTo: 'login' }
];
