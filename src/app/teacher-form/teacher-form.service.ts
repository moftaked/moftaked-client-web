import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface deleteResultBody {
  affectedRows: number
}

@Injectable({
  providedIn: 'root'
})
export class TeacherFormService {

  constructor(
    private http: HttpClient, 
    private authService: AuthService
  ) { }

  createTeacher(
    teacher_name: string | null | undefined, 
    address: string | null | undefined, 
    phone_number: string | null | undefined, 
    second_phone_number: string | null | undefined,
    district: string | null | undefined,
    notes: string | null | undefined,
    class_id: string | null | undefined,
  ) {
    return this.http.post(
      `/teachers`, 
      {
        teacher_name, 
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

  updateTeacher(
    teacher_id: string | null | undefined,
    teacher_name: string | null | undefined, 
    address: string | null | undefined, 
    phone_number: string | null | undefined, 
    second_phone_number: string | null | undefined,
    district: string | null | undefined,
    notes: string | null | undefined,
  ) {
    return this.http.patch(
      `/teachers/${teacher_id}`, 
      {
        teacher_name, 
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

  deleteTeacher(id: string) {
    return this.http.delete<deleteResultBody>(`/teachers/${id}`, {
      observe: 'response',
      headers: {
        'Authorization': this.authService.getAuthorizationHeader()
      }
    })
  }
}
