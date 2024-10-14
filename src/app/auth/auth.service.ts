import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface loginResultBody {
  access_token: string;
  user_id: string;
  roles: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient,) {}

  login(username: string | null | undefined, password: string | null | undefined) {
    return this.http.post<loginResultBody>(`/auth/login`, {username, password}, {observe: 'response'});
  }

  setJwt(token: string) {
    window.localStorage.setItem('jwt', token);
  }

  getJwt(): string | null {
    return window.localStorage.getItem('jwt');
  }

  setRoles(rolesString: string) {
    window.localStorage.setItem('roles', rolesString);
  }

  getRoles(): [{class_id: number, role: string}] | null {
    const rolesString = window.localStorage.getItem('roles');
    if(rolesString == null)
      return null;
    return JSON.parse(rolesString);
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
