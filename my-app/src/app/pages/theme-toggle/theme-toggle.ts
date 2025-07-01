import { Component, OnInit, OnDestroy } from '@angular/core';
import { Theme } from '../../services/theme';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-theme-toggle',
  imports: [MatIconModule, MatSlideToggleModule],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss'
})
export class ThemeToggle implements OnInit, OnDestroy {
  isDarkTheme = true;
  private destroy$ = new Subject<void>();

  constructor(private themeService: Theme) {}

  ngOnInit(): void {
    this.themeService.isDarkTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isDark => {
        this.isDarkTheme = isDark;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onThemeToggle(event: any): void {
    this.themeService.toggleTheme();
  }

}
