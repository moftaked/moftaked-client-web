import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { Class, classResultBody, UserService } from '../services/user.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [AppHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit{
  classes: Class[] = [];
  
  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    const observable = this.userService.getClasses().subscribe({
      next: (res: HttpResponse<classResultBody>) => {
        if(res.body)
          this.classes = res.body.results;
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401)
          this.router.navigate(['/login'])
        console.log(err);
      }
    })
  }

}
