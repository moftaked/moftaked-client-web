import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { eventsResultBody } from '../events/events-page.service';
import { AuthService } from '../auth/auth.service';

export interface attendance {
  person_id: number;
  person_name: string;
  attended: 0 | 1;
}

export interface attendanceRes {
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

  getTeachersEventName(classId: number, eventId: number) {
    return this.http.get<eventsResultBody>(
      `classes/${classId}/teachers/events/${eventId}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getStudentAttendees(classId: number, eventId: number) {
    return this.http.get<attendanceRes>(
      `classes/${classId}/students/events/${eventId}/attendance`,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  getTeachersAttendees(classId: number, eventId: number) {
    return this.http.get<attendanceRes>(
      `classes/${classId}/teachers/events/${eventId}/attendance`,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  createStudentEventOccurence(classId: number, eventId: number) {
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

  createTeacherEventOccurence(classId: number, eventId: number) {
    return this.http.post(
      `classes/${classId}/teachers/events/${eventId}/occurences`,
      null,
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    )
  }

  createStudentAttendance(
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

  createTeacherAttendance(
    classId: number, 
    eventId: number, 
    attendance: {attendance: number[], absence: number[]},
  ) {
    return this.http.post(
      `classes/${classId}/teachers/events/${eventId}/attendance`,
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
