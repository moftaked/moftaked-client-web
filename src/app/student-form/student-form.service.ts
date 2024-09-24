import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface deleteResultBody {
  affectedRows: number
}

@Injectable({
  providedIn: 'root'
})
export class StudentFormService {

  constructor(
    private http: HttpClient, 
    private authService: AuthService
  ) { }

  createStudent(
    student_name: string | null | undefined, 
    address: string | null | undefined, 
    phone_number: string | null | undefined, 
    second_phone_number: string | null | undefined,
    district: string | null | undefined,
    notes: string | null | undefined,
    class_id: string | null | undefined,
  ) {
    return this.http.post(
      `/students`, 
      {
        student_name, 
        address, 
        phone_number, 
        second_phone_number: second_phone_number? second_phone_number: undefined, 
        district,
        notes: notes? notes: undefined,
        class_id: Number(class_id), 
      }, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  updateStudent(
    student_id: string | null | undefined,
    student_name: string | null | undefined, 
    address: string | null | undefined, 
    phone_number: string | null | undefined, 
    second_phone_number: string | null | undefined,
    district: string | null | undefined,
    notes: string | null | undefined,
  ) {
    return this.http.patch(
      `/students/${student_id}`, 
      {
        student_name, 
        address, 
        phone_number, 
        second_phone_number: second_phone_number? second_phone_number: undefined, 
        district,
        notes: notes? notes: undefined,
      }, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      }
    );
  }

  deleteStudent(id: string) {
    return this.http.delete<deleteResultBody>(`/students/${id}`, {
      observe: 'response',
      headers: {
        'Authorization': this.authService.getAuthorizationHeader()
      }
    })
  }
}
