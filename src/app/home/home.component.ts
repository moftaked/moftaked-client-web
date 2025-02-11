import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { Class, userClassesResultBody, UserService } from '../services/user.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ClassCardComponent } from '../class-card/class-card.component';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { EventsPageService, eventsResultBody } from '../events/events-page.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ClassService } from '../class/class.service';

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
    private eventsPageServices: EventsPageService,
    private attendanceService: AttendanceService,
    private classService: ClassService
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
          this.classes.forEach((classItem) => {
            const eventNext = (res: HttpResponse<eventsResultBody>) => {
              res.body?.events.forEach((eventItem) => {
                this.classService.getClassName(classItem.class_id).subscribe();
                this.attendanceService.getStudentsEventName(classItem.class_id, eventItem.event_id).subscribe();
                this.attendanceService.getTeachersEventName(classItem.class_id, eventItem.event_id).subscribe();
                this.attendanceService.getStudentAttendees(classItem.class_id, eventItem.event_id).subscribe();
                this.attendanceService.getTeachersAttendees(classItem.class_id, eventItem.event_id).subscribe();
              })
            };
            this.eventsPageServices.getStudentsServices(classItem.class_id.toString()).subscribe({
              next: eventNext
            });
            this.eventsPageServices.getTeachersServices(classItem.class_id.toString()).subscribe({
              next: eventNext
            });
          });
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
