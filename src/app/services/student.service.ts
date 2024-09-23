import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface student {
  student_id: number, 
  student_name: string, 
  address: string, 
  phone_numbers: string,
  district: string,
  notes: string,
}

export interface studentResultBody {students: student[]}

@Injectable({
  providedIn: 'root'
})
export class StudentService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getStudent(id: string | null) {
    return this.http.get<studentResultBody>(
      `/students/${id}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}
