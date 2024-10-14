import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface Class {
  class_id: number;
  class_name: string;
}
export interface userClassesResultBody {
  results: Class[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getClasses() {
    return this.http.get<userClassesResultBody>(
      `/users/${this.getUserId()}/classes`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  setUserId(userId: string) {
    localStorage.setItem('user_id', userId);
  }

  getUserId(): string | null {
    return localStorage.getItem('user_id');
  }
}
