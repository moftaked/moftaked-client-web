import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { AuthService } from '../auth/auth.service';

export interface Class {
  class_id: string;
  class_name: string;
}
export interface classResultBody {
  results: Class[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient, private config: ConfigService, private authService: AuthService) { }

  getClasses() {
    return this.http.get<classResultBody>(
      `${this.config.getBackendLink()}/users/${this.getUserId()}/classes`, 
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
