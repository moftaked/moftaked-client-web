import { Component } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.css'
})
export class AppHeaderComponent {
  logOutClicks = 0;
  message = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogoutClick() {
    this.logOutClicks++;
    setTimeout(() => {this.logOutClicks = 0; this.message = ''}, 5000);
    if(this.logOutClicks == 1)
      this.message = 'متأكد عاوز تسجل خروج؟ دوس تاني'
    else if(this.logOutClicks >= 2){
      this.authService.markTokenInvalid();
      this.router.navigate(['login'])
    }
  }

  onLogoClick() {
    this.router.navigate(['']);
  }
}
