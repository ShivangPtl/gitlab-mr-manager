import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Theme } from './services/theme';
import { LoaderService } from './services/loader';
import { Observable } from 'rxjs';
import { Loader } from './pages/loader/loader';
import { CommonModule } from '@angular/common';
import { Navbar } from './pages/navbar/navbar';
import { ThemeToggle } from './pages/theme-toggle/theme-toggle';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggle, Loader, CommonModule, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  isLoading$: Observable<boolean>;
  loaderMessage$: Observable<string>;
  loaderType$: Observable<'spinner' | 'dots' | 'pulse'>;
  showNavbar = true;

  constructor(
    private themeService: Theme,
    private loaderService: LoaderService,
    private router: Router
  ) {
    this.themeService.applyFromSettings();

    this.isLoading$ = this.loaderService.loading$;
    this.loaderMessage$ = this.loaderService.message$;
    this.loaderType$ = this.loaderService.loaderType$;

    this.router.events.subscribe(() => {
      this.showNavbar = !this.router.url.includes('/login');
    });
  }
}