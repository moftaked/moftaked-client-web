import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { NavMenuComponent } from "../nav-menu/nav-menu.component";
import { ActivatedRoute, Router } from '@angular/router';
import { EventReportService, lastFiveWeeksResBody, weekAttendanceRecord } from './event-report.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-event-report',
  standalone: true,
  imports: [AppHeaderComponent, NavMenuComponent],
  templateUrl: './event-report.component.html',
  styleUrl: './event-report.component.css'
})
export class EventReportComponent implements OnInit{
  eventName = '';
  schoolId = '';
  classId =  '';
  eventType = '';
  date = '';
  lastFiveWeeksAttendance: lastFiveWeeksResBody | null = null;
  polyLinePoints = '';
  attendance: [weekAttendanceRecord] = [] as unknown[] as [weekAttendanceRecord];
  math = Math

  constructor(
    private router: Router,
    private route: ActivatedRoute, 
    private eventReportService: EventReportService
  ) {}

  ngOnInit() {
    this.eventName = this.route.snapshot.paramMap.get('eventName') || '';
    this.schoolId = this.route.snapshot.paramMap.get('schoolId') || '';
    this.classId = this.route.snapshot.paramMap.get('classId') || '';
    this.eventType = this.route.snapshot.paramMap.get('type') || '';
    this.date = this.route.snapshot.paramMap.get('date') || '';
    if(this.schoolId) {
      const observable = this.eventReportService.getManagerLastFiveWeeksAttendance(this.schoolId, this.eventName, this.eventType, this.date)
      observable.subscribe({
        next: (res) => {
          this.lastFiveWeeksAttendance = res.body;
          if(this.lastFiveWeeksAttendance){
            this.attendance = this.lastFiveWeeksAttendance.results;
            const polyLineWidth = 200;
            const polyLineHeight = 100;
            for(let index = 0; index < this.attendance.length; index++) {
              this.polyLinePoints = this.polyLinePoints + Math.round(((this.attendance.length - index - 1)/(this.attendance.length-1))*polyLineWidth+12) + ',' + Math.round((1 - (this.attendance[index].attended/this.attendance[index].total) || 0 )*polyLineHeight+1) + ' ';
            }
          }
        }
      })
    } else if(this.classId) {
      console.log("AAAAAAAAAAAA" ,this.classId)
      const leaderObservable = this.eventReportService.getLeaderLastFiveWeeksAttendance(this.classId, this.eventName, this.eventType, this.date)
      leaderObservable.subscribe({
        next: (res) => {
          this.lastFiveWeeksAttendance = res.body;
          if(this.lastFiveWeeksAttendance){
            this.attendance = this.lastFiveWeeksAttendance.results;
            const polyLineWidth = 200;
            const polyLineHeight = 100;
            for(let index = 0; index < this.attendance.length; index++) {
              this.polyLinePoints = this.polyLinePoints + Math.round(((this.attendance.length - index - 1)/(this.attendance.length-1))*polyLineWidth+12) + ',' + Math.round((1 - (this.attendance[index].attended/this.attendance[index].total) || 0 )*polyLineHeight+1) + ' ';
            }
          }
        },
        error: () => {
          this.router.navigate(['report/class', this.classId, this.eventName, 'student', this.date])
        }
      })
      const teacherObservable = this.eventReportService.getTeacherLastFiveWeeksAttendance(this.classId, this.eventName, this.eventType, this.date)
      teacherObservable.subscribe({
        next: (res) => {
          this.lastFiveWeeksAttendance = res.body;
          if(this.lastFiveWeeksAttendance){
            this.attendance = this.lastFiveWeeksAttendance.results;
            const polyLineWidth = 200;
            const polyLineHeight = 100;
            for(let index = 0; index < this.attendance.length; index++) {
              this.polyLinePoints = this.polyLinePoints + Math.round(((this.attendance.length - index - 1)/(this.attendance.length-1))*polyLineWidth+12) + ',' + Math.round((1 - (this.attendance[index].attended/this.attendance[index].total) || 0 )*polyLineHeight+1) + ' ';
            }
          }
        },
        error: (error: HttpErrorResponse) => {
          if(error.status == 401)
            this.router.navigate(['login'])
        }
      })
    }
  }
}
