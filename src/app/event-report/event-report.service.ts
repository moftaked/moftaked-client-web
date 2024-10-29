import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface weekAttendanceRecord {
  occurence_date: string; 
  attended: number;
  total: number;
}

export interface lastFiveWeeksResBody {
  length: number,
  results: [weekAttendanceRecord]
}

@Injectable({
  providedIn: 'root'
})
export class EventReportService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getManagerLastFiveWeeksAttendance(
    schoolId: string,
    eventName: string,
    type: string,
    date: string,
  ) {
    return this.http.get<lastFiveWeeksResBody>(
      `/schools/${schoolId}/managers/reports/${eventName}/${type}?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  getLeaderLastFiveWeeksAttendance(
    classId: string,
    eventName: string,
    type: string,
    date: string,
  ) {
    return this.http.get<lastFiveWeeksResBody>(
      `/schools/leaders/reports/${classId}/${eventName}/${type}?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  getTeacherLastFiveWeeksAttendance(
    classId: string,
    eventName: string,
    type: string,
    date: string,
  ) {
    return this.http.get<lastFiveWeeksResBody>(
      `/schools/teachers/reports/${classId}/${eventName}?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }
}
