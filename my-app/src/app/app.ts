import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggle } from "./pages/theme-toggle/theme-toggle";
import { Theme } from "./services/theme";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(private themeService: Theme) {}
  protected title = 'my-app';
}
