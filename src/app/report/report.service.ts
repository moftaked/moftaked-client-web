import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface overAllStat {
  type: string; 
  attended: number; 
  total: number;
}

export interface managerOverAllStatsResultBody {
  overAllStats: [
    {
      school_id: number,
      school_name: string,
      stats: [{
        event_name: string,
        stats: [overAllStat]
      }]
    }
  ]
}

export interface classOverAllStatsResultBody {
  overAllStats: [
    {
      class_id: number,
      class_name: string,
      stats: [{
        event_name: string,
        type: string,
        attended: number,
        total: number
      }]
    }
  ]
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getManagarialOverAllStats(account_id: string | null, date: string) {
    return this.http.get<managerOverAllStatsResultBody>(
      `/schools/managers/${account_id}/reports?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getLeaderOverAllStats(account_id: string | null, date: string) {
    return this.http.get<classOverAllStatsResultBody>(
      `/schools/leaders/${account_id}/reports?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }

  getTeacherOverAllStats(account_id: string | null, date: string) {
    return this.http.get<classOverAllStatsResultBody>(
      `/schools/teachers/${account_id}/reports?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}
