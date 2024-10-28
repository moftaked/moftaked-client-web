import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { ActivatedRoute, Router } from '@angular/router';
import { ClassCardComponent } from '../class-card/class-card.component';
import { EventsPageService } from './events-page.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    AppHeaderComponent,
    ClassCardComponent,
    NavMenuComponent
],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.css'
})
export class EventsPageComponent implements OnInit {
  
  studentEvents: [{ event_id: number; event_name: string; }] | undefined;
  teacherEvents: [{ event_id: number; event_name: string; }] | undefined;

  classId: string | null = '';
  isUserLeader = false;

  constructor(
    private eventsPageService: EventsPageService, 
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId');
    this.isUserLeader = this.authService.getRoles().some((role) => {return (role.class_id.toString() == this.classId) && (role.role == 'leader' || role.role == 'manager')})
    if(this.classId){
      if(this.isUserLeader) {
        const teachersEventsbservable = this.eventsPageService.getTeachersServices(this.classId);
        teachersEventsbservable.subscribe({
          next: (res) => {
            this.teacherEvents = res.body?.events;
          },
          error: (err: HttpErrorResponse) => {
            if(err.status == 401){
              this.authService.markTokenInvalid();
              this.router.navigate(['/login'])
            }
          }
        })
      }

      const studentsEventsbservable = this.eventsPageService.getStudentsServices(this.classId);
      studentsEventsbservable.subscribe({
        next: (res) => {
          this.studentEvents = res.body?.events;
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 401){
            this.authService.markTokenInvalid();
            this.router.navigate(['/login'])
          }
        }
      })

    }
  }

  onCardClick(eventId: number, type: 'students' | 'teachers') {
    console.log(`clicked on event: ${eventId}`)
    this.router.navigate(['class', this.classId, 'events', eventId, type])
  }
}
