import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

export interface loginResultBody {
  access_token: string;
  user_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient, private config: ConfigService,) { }

  login(username: string | null | undefined, password: string | null | undefined) {
    return this.http.post<loginResultBody>(`${this.config.getBackendLink()}/auth/login`, {username, password}, {observe: 'response'});
  }

  setJwt(token: string) {
    window.localStorage.setItem('jwt', token);
  }

  getJwt(): string | null {
    return window.localStorage.getItem('jwt');
  }

  markTokenInvalid() {
    window.localStorage.removeItem('jwt');
  }

  checkIsTokenValid() {
    const token = this.getJwt();
    if(token == null || token == undefined || token == ''){
      this.markTokenInvalid();
      return false;
    }
    return true;
  }

  getAuthorizationHeader() {
    return `Bearer ${this.getJwt()}`;
  }
}
