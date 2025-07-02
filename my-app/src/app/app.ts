import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggle } from "./pages/theme-toggle/theme-toggle";
import { Theme } from "./services/theme";
import { LoaderService } from "./services/loader";
import { Observable } from 'rxjs';
import { Loader } from './pages/loader/loader';
import { CommonModule } from '@angular/common';

declare const window: any;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggle, Loader, CommonModule],
  templateUrl: './app.html',  
  styleUrl: './app.scss'
})
export class App {
  isLoading$: Observable<boolean>;
  loaderMessage$: Observable<string>;
  loaderType$: Observable<'spinner' | 'dots' | 'pulse'>;
  darkMode: boolean = true;
  constructor(private themeService: Theme, private loaderService: LoaderService) {
    window.electronAPI.getSettings().then((data: any) => {
      if (data.darkMode !== undefined) this.darkMode = data.darkMode;

      this.applyTheme(this.darkMode);
    });

    this.isLoading$ = this.loaderService.loading$;
    this.loaderMessage$ = this.loaderService.message$;
    console.log(this.loaderMessage$);
    this.loaderType$ = this.loaderService.loaderType$;
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
