import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
  standalone: true
})
export class Navbar {
  userName = 'Shivang Patel';

  constructor(private router: Router) {}

  goTo(route: string) {
    this.router.navigate([route]);
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}