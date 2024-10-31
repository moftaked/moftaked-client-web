import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface event {
  event_name: string;
  records: [{ person_name: string; absent: number }];
  toggled?: boolean;
}
export interface type {
  type: string; 
  events: event[];
}

export interface IClass {
  class_name: string;
  types: type[];
}

export interface school {
  school_id: number,
  school_name: string,
  classes: IClass[];
}
export interface absenceResultBody {
  schools: [school]
};

@Injectable({
  providedIn: 'root'
})
export class HeartService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getSchoolAbsentTeachers(
    userId: string | null,
    occurences: number,
    minCount: number,
  ) {
    return this.http.get<absenceResultBody>(
      `/schools/managers/${userId}/absence/teachers/?occurences=${occurences}&minCount=${minCount}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  getLeaderAbsence(
    userId: string | null,
    occurences: number,
    minCount: number,
  ) {
    return this.http.get<absenceResultBody>(
      `/schools/leaders/${userId}/absence/?occurences=${occurences}&minCount=${minCount}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  getTeacherAbsence(
    userId: string | null,
    occurences: number,
    minCount: number,
  ) {
    return this.http.get<absenceResultBody>(
      `/schools/teachers/${userId}/absence/?occurences=${occurences}&minCount=${minCount}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  
}
