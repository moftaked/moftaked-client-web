import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { event, HeartService, school } from './heart.service';
import { UserService } from '../services/user.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-heart',
  standalone: true,
  imports: [AppHeaderComponent, NavMenuComponent],
  templateUrl: './heart.component.html',
  styleUrl: './heart.component.css'
})
export class HeartComponent implements OnInit{
  schools: school[] = [] as unknown[] as school[];
  occurencesCount = 4;
  minCount = 0;

  constructor(private router: Router, private heartService: HeartService, private userService: UserService) {}
  
  ngOnInit(): void {
    this.heartService.getSchoolAbsentTeachers(this.userService.getUserId(), this.occurencesCount, this.minCount).subscribe({
      next: (res => {
        if(res.body)
          this.schools = res.body?.schools;
      }),
      error: () => {
        this.heartService.getLeaderAbsence(this.userService.getUserId(), this.occurencesCount, this.minCount).subscribe({
          next: (res) => {
            if(res.body) 
              this.schools = res.body.schools;
          },
          error: () => {
            this.heartService.getTeacherAbsence(this.userService.getUserId(), this.occurencesCount, this.minCount).subscribe({
              next: (res) => {
                if(res.body)
                  this.schools = res.body.schools;
              },
              error: (error: HttpErrorResponse) => {
                if(error.status == 401)
                  this.router.navigate(['login']);
              }
            })
          }
        })
      }
    });
  }

  toggleTable(event : event) {
    if(event.toggled) {
      event.toggled = false;
    } else {
      event.toggled = true;
    }
  }

}
