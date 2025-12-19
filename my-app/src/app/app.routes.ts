import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Settings } from './pages/settings/settings';
import { Pipelines } from './pages/pipelines/pipelines';
import { MergeRequests } from './pages/merge-requests/merge-requests';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'home', component: Home },
  { path: 'merge-requests', component: MergeRequests },
  { path: 'pipelines', component: Pipelines },
  { path: 'settings', component: Settings },
  { path: '**', redirectTo: 'login' }
];
