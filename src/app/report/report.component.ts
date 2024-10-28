import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { overAllStatsResultBody, ReportService } from './report.service';
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
  overAllStats: overAllStatsResultBody | undefined = undefined;
  progress = 0;
  math = Math
  years: number[] = [];
  months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  days: number[] = [];
  today = new Date(); 
  selectedYear: number = this.today.getFullYear();
  selectedMonth: number = this.months[this.today.getMonth()];
  selectedDay: number = this.today.getDate();

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
    const daysInMonth = new Date(this.selectedYear, this.months.indexOf(this.selectedMonth) + 1, 0).getDate();
    this.days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    console.log(this.days);
  }

  getReports() {
    const selectedDate = `${this.selectedYear}-${this.months.indexOf(this.selectedMonth) + 1}-${this.selectedDay}`;
    const overAllStatsObservable = this.reportService.getOverAllStats(this.userService.getUserId(), selectedDate);
    overAllStatsObservable.subscribe({
      next: (res => {
        if(res.body) this.overAllStats = res.body;
        if(this.overAllStats)
          this.progress = this.overAllStats.overAllStats[0].stats[0].stats[0].attended;
        console.log(this.overAllStats)
      })
    })
  }

  openEventReport(schoolId: number, eventName: string, type: string) {
    const selectedDate = `${this.selectedYear}-${this.months.indexOf(this.selectedMonth) + 1}-${this.selectedDay}`;
    this.router.navigate(['report', schoolId, eventName, type, selectedDate])
  }
}
