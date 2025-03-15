import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { Class, userClassesResultBody, UserService } from '../services/user.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ClassCardComponent } from '../class-card/class-card.component';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { SyncingService } from '../core/syncing.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    AppHeaderComponent,
    ClassCardComponent,
    NavMenuComponent
],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit{
  classes: Class[] = [];

  constructor(
    private userService: UserService, 
    private router: Router,
    private authService: AuthService,
    private syncingService: SyncingService
  ) {}

  ngOnInit(): void {
    this.userService.profile().subscribe({
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
    this.userService.getClasses().subscribe({
      next: (res: HttpResponse<userClassesResultBody>) => {
        if(res.body)
          this.classes = res.body.results;
        this.syncingService.syncData(this.classes);
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
    this.router.navigate([`/class/${classId}`]);
  }
}
