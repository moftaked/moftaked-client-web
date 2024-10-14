import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { eventsResultBody } from '../events/events-page.service';
import { AuthService } from '../auth/auth.service';

export interface attendance {
  person_id: number;
  person_name: string;
  attended: 0 | 1;
}

export interface studentAttendanceRes {
  attendance: attendance[]
  date: [{
    occurence_date: string
  }];
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  getStudentsEventName(classId: number, eventId: number) {
    return this.http.get<eventsResultBody>(
      `classes/${classId}/students/events/${eventId}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getStudentAttendees(classId: number, eventId: number) {
    return this.http.get<studentAttendanceRes>(
      `classes/${classId}/students/events/${eventId}/attendance`,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  createEventOccurence(classId: number, eventId: number) {
    return this.http.post(
      `classes/${classId}/students/events/${eventId}/occurences`,
      null,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    )
  }

  createAttendance(
    classId: number, 
    eventId: number, 
    attendance: {attendance: number[], absence: number[]},
  ) {
    return this.http.post(
      `classes/${classId}/students/events/${eventId}/attendance`,
      attendance,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    )
  }
}
