import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface overAllStat {
  type: string; 
  attended: number; 
  total: number;
}
export interface overAllStatsResultBody {
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

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor(private http: HttpClient, private authService: AuthService) { }

  getOverAllStats(account_id: string | null, date: string) {
    return this.http.get<overAllStatsResultBody>(
      `/schools/managers/${account_id}/reports?date=${date}`, 
      {
        observe: 'response',
        headers: {
          'Authorization': this.authService.getAuthorizationHeader()
        }
      });
  }
}
