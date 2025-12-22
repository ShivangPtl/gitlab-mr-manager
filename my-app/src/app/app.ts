import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ThemeToggle } from "./pages/theme-toggle/theme-toggle";
import { Theme } from "./services/theme";
import { LoaderService } from "./services/loader";
import { Observable } from 'rxjs';
import { Loader } from './pages/loader/loader';
import { CommonModule } from '@angular/common';
import { Navbar } from "./pages/navbar/navbar";

declare const window: any;

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
  darkMode: boolean = true;
  showNavbar = true;
  constructor(private themeService: Theme, private loaderService: LoaderService, private router: Router) {
    window.electronAPI.getSettings().then((data: any) => {
      if (data.darkMode !== undefined) this.darkMode = data.darkMode;

      this.applyTheme(this.darkMode);
    });

    this.isLoading$ = this.loaderService.loading$;
    this.loaderMessage$ = this.loaderService.message$;
    this.loaderType$ = this.loaderService.loaderType$;

    this.router.events.subscribe(() => {
    const current = this.router.url;

    // hide navbar on login route
    this.showNavbar = !current.includes('/login');
  });
  }
  protected title = 'my-app';


  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }
  
}
