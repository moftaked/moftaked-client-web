import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { ActivatedRoute, Router } from '@angular/router';
import { ClassCardComponent } from '../class-card/class-card.component';
import { EventsPageService } from './events-page.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    AppHeaderComponent,
    ClassCardComponent
  ],
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.css'
})
export class EventsPageComponent implements OnInit {
  
  studentEvents: [{ event_id: number; event_name: string; }] | undefined;
  classId: string | null = '';

  constructor(
    private eventsPageService: EventsPageService, 
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId');
    if(this.classId){
      const observable = this.eventsPageService.getStudentsServices(this.classId);
      observable.subscribe({
        next: (res) => {
          this.studentEvents = res.body?.events;
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 401)
            this.router.navigate(['/login'])
        }
      })

    }
  }

  onCardClick(eventId: number) {
    console.log(`clicked on event: ${eventId}`)
    this.router.navigate(['class', this.classId, 'events', eventId])
  }
}
