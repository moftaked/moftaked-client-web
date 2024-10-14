import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { teachersResultBody } from '../class/class.service';

export interface teacher {
  teacher_id: number, 
  teacher_name: string, 
  address: string, 
  phone_numbers: string,
  district: string,
  notes: string,
}

@Injectable({
  providedIn: 'root'
})
export class TeachersService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getTeacher(id: string | null) {
    return this.http.get<teachersResultBody>(
      `/teachers/${id}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}
