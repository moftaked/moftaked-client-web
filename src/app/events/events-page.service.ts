import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface eventsResultBody {
  events: [{event_id: number, event_name: string}]
}

@Injectable({
  providedIn: 'root'
})
export class EventsPageService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getStudentsServices(classId: string) {
    return this.http.get<eventsResultBody>(
      `classes/${classId}/students/events`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getTeachersServices(classId: string) {
    return this.http.get<eventsResultBody>(
      `classes/${classId}/teachers/events`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}
