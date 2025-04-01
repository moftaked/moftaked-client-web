import { Component, OnInit } from '@angular/core';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { ClassCardComponent } from "../class-card/class-card.component";
import { AppHeaderComponent } from "../app-header/app-header.component";
import { Class, userClassesResultBody, UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-events-home',
  standalone: true,
  imports: [NavMenuComponent, ClassCardComponent, AppHeaderComponent],
  templateUrl: './events-home.component.html',
  styleUrl: '../home/home.component.css'
})
export class EventsHomeComponent implements OnInit {

  classes: Class[] = [];

  constructor(
    private userService: UserService, 
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userService.getClasses().subscribe({
      next: (res: HttpResponse<userClassesResultBody>) => {
        if(res.body)
          this.classes = res.body.results;
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401){
          this.authService.markTokenInvalid();
          this.router.navigate(['/login'])
        }
      }
    })
  }

  onCardClick(classId: number) {
    this.router.navigate(['class', classId, 'events']);
  }
}
