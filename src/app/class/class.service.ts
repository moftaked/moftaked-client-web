import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Class } from '../services/user.service';
import { student } from '../services/student.service';
import { teacher } from '../services/teachers.service';

export type classResultBody = Class[];

export interface studentsResultBody {
  students: student[];
  metadata: [{count: number}]
}

export interface teachersResultBody {
  teachers: teacher[];
  metadata: [{count: number}]
}

@Injectable({
  providedIn: 'root'
})
export class ClassService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getClassName(id: string | number | null) {
    return this.http.get<classResultBody>(
      `/classes/${id}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getStudents(id: string | null) {
    return this.http.get<studentsResultBody>(
      `/classes/${id}/students`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getTeachers(id: string | null) {
    return this.http.get<teachersResultBody>(
      `/classes/${id}/teachers`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}

