import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { classOverAllStatsResultBody, managerOverAllStatsResultBody, ReportService } from './report.service';
import { UserService } from '../services/user.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [AppHeaderComponent, NavMenuComponent, FormsModule],
  templateUrl: './report.component.html',
  styleUrl: './report.component.css'
})
export class ReportComponent implements OnInit{
  loading = false;
  managarialOverAllStats: managerOverAllStatsResultBody | undefined = undefined;  
  leaderOverAllStats: classOverAllStatsResultBody | undefined = undefined;
  teacherOverAllStats: classOverAllStatsResultBody | undefined = undefined;
  math = Math
  years: number[] = [];
  months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  days: number[] = [];
  today = new Date(); 
  selectedYear: number = this.today.getFullYear();
  selectedMonth: number = this.today.getMonth() + 1;
  selectedDay: number = this.today.getDate();
  selectedDate = `${this.selectedYear}-${this.selectedMonth}-${this.selectedDay}`;

  constructor(
    private reportService: ReportService, 
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    for (let year = 2024; year <= this.today.getFullYear(); year++) {
      this.years.push(year);
    }
    this.updateDays();
  }
  
  updateDays() {
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    this.days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  getReports() {
    this.loading = true;
    this.selectedDate = `${this.selectedYear}-${this.selectedMonth}-${this.selectedDay}`;
    const managerOverAllStatsObservable = this.reportService.getManagarialOverAllStats(this.userService.getUserId(), this.selectedDate);
    managerOverAllStatsObservable.subscribe({
      next: (res => {
        this.loading = false;
        if(res.body) this.managarialOverAllStats = res.body;
      }),
      error: () => {this.loading = false;}
    });
    const leaderOverAllStatsObservable = this.reportService.getLeaderOverAllStats(this.userService.getUserId(), this.selectedDate);
    leaderOverAllStatsObservable.subscribe({
      next: (res => {
        this.loading = false;
        if(res.body) this.leaderOverAllStats = res.body;
      }),
      error: () => {this.loading = false;}
    });

    const teacherOverAllStatsObservable = this.reportService.getTeacherOverAllStats(this.userService.getUserId(), this.selectedDate);
    teacherOverAllStatsObservable.subscribe({
      next: (res => {
        this.loading = false;
        if(res.body) this.teacherOverAllStats = res.body;
      }),
      error: () => {this.loading = false;}
    });
  }

  openManagerEventReport(schoolId: number, eventName: string, type: string) {
    this.router.navigate(['report/manager', schoolId, eventName, type, this.selectedDate])
  }

  openClassEventReport(classId: number, eventName: string, type: string) {
    this.router.navigate(['report/class', classId, eventName, type, this.selectedDate])
  }
}
