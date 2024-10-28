import { Component, OnInit } from '@angular/core';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { ClassService } from '../class/class.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { attendance, AttendanceService } from './attendance.service';
import { ErrorMessageComponent } from '../error-message/error-message.component';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [AppHeaderComponent, ErrorMessageComponent, NavMenuComponent],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css'
})
export class AttendanceComponent implements OnInit{
  classId = -1;
  className = '';
  eventId = -1;
  eventName = '';
  attendance: attendance[] = [];
  attended = new Set<number>();
  absent = new Set<number>();
  isLeader = false;
  isAdmin = false;
  date: Date | undefined;
  errorMessage = '';
  attendanceFlushSuccess = false;
  type: 'students' | 'teachers' | undefined;
  constructor(
    private classService: ClassService, 
    private attendanceService: AttendanceService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const url = this.route.snapshot.url;
    this.classId = Number(this.route.snapshot.paramMap.get('classId'));
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    this.isLeader = this.authService.getRoles()?.some((role) => {return (role.class_id == this.classId) && ((role.role == 'leader') || (role.role == 'manager'))}) || false;
    this.isAdmin = this.authService.getRoles()?.some((role) => {return (role.class_id == this.classId) && ((role.role == 'manager'))}) || false;
    if(url[url.length-1]?.toString() === 'teachers')
      this.type = 'teachers';
    else if(url[url.length-1]?.toString() === 'students')
      this.type = 'students';
    console.log(this.type)
    const classObservable = this.classService.getClassName(this.classId);
    classObservable.subscribe({
      next: (res) => {
        if(res.body)
          this.className = res.body[0].class_name;
      },
      error: (err: HttpErrorResponse) => {
        if(err.status == 401){
          this.authService.markTokenInvalid();
          this.router.navigate(['/login'])
        }
      }
    });

    if(this.type == 'students'){
      const eventObservable = this.attendanceService.getStudentsEventName(this.classId, this.eventId);
      eventObservable.subscribe({
        next: (res) => {
          if(res.body)
            this.eventName = res.body.events[0].event_name;
        }
      })
    } else if(this.type == 'teachers'){
      const eventObservable = this.attendanceService.getTeachersEventName(this.classId, this.eventId);
      eventObservable.subscribe({
        next: (res) => {
          if(res.body)
            this.eventName = res.body.events[0].event_name;
        }
      })
    }

    this.getAttendance();
  }

  getAttendance() {
    if(this.type == 'students') {
      const attendanceObservable = this.attendanceService.getStudentAttendees(this.classId, this.eventId);
      attendanceObservable.subscribe({
        next: (res) => {
          if(res.body){
            this.attendance = res.body.attendance;
            this.date = new Date(Date.parse(res.body.date[0].occurence_date))
            console.log(res.body)
          }
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 404){
            if(this.type == 'students') this.errorMessage = 'الخدمة دي لسة متضافلهاش ايام غياب، لازم الليدر او أمين الخدمة يعمل اضافة يوم عشان تبدأ تاخد غياب انهاردة';
            if(this.type == 'teachers') this.errorMessage =  'الخدمة دي لسة متضافلهاش ايام غياب، لازم أمين الخدمة يعمل اضافة يوم عشان تبدأ تاخد غياب انهاردة';
          }
        }
      });
    } else if(this.type == 'teachers') {
      const attendanceObservable = this.attendanceService.getTeachersAttendees(this.classId, this.eventId);
      attendanceObservable.subscribe({
        next: (res) => {
          if(res.body){
            this.attendance = res.body.attendance;
            this.date = new Date(Date.parse(res.body.date[0].occurence_date))
            console.log(res.body)
          }
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 404)
            this.errorMessage = 'الخدمة دي لسة متضافلهاش ايام غياب، لازم الليدر او أمين الخدمة يعمل اضافة يوم عشان تبدأ تاخد غياب انهاردة';
        }
      });
    }
  }

  onAddDayClick() {
    if(this.type == 'students') {
      const observable = this.attendanceService.createStudentEventOccurence(this.classId, this.eventId);
      observable.subscribe(() => {
        this.errorMessage = ''
        this.getAttendance()
      })
    } else if(this.type == 'teachers') {
      const observable = this.attendanceService.createTeacherEventOccurence(this.classId, this.eventId);
      observable.subscribe(() => {
        this.errorMessage = ''
        this.getAttendance()
      })
    }
  }

  convertToArabicDayName(dayOfWeek: number) {
    if(dayOfWeek == 0) return 'الأحد';
    if(dayOfWeek == 1) return 'الإثنين';
    if(dayOfWeek == 2) return 'الثلاثاء';
    if(dayOfWeek == 3) return 'الأربعاء';
    if(dayOfWeek == 4) return 'الخميس';
    if(dayOfWeek == 5) return 'الجمعة';
    if(dayOfWeek == 6) return 'السبت';
    return '';
  }

  onPersonCardClick(person: attendance) {
    if(person.attended == 0) {
      this.absent.delete(person.person_id);
      this.attended.add(person.person_id);
    } else {
      this.attended.delete(person.person_id);
      this.absent.add(person.person_id);
    }
    person.attended = Math.abs(person.attended - 1) as 0 | 1;
    console.log('attended: ', this.attended);
    console.log('absent: ', this.absent)
  }
  
  flushAttendance() {
    this.attendanceFlushSuccess = false;
    const attendance = {attendance: new Array<number>(), absence: new Array<number>()};
    this.attended.forEach((personId) => {attendance.attendance.push(personId)});
    this.attended.clear();
    this.absent.forEach((personId) => {attendance.absence.push(personId)});
    this.absent.clear();
    if(attendance.attendance.length +  attendance.absence.length > 0){
      console.log(attendance.attendance, attendance.absence);
      if(this.type == 'students') {
        this.attendanceService.createStudentAttendance(this.classId, this.eventId, attendance).subscribe(
          () => {
            this.attendanceFlushSuccess = true;
            setTimeout(() => {this.attendanceFlushSuccess = false}, 5000);
          }
        );
      } else if(this.type == 'teachers') {
        this.attendanceService.createTeacherAttendance(this.classId, this.eventId, attendance).subscribe(
          () => {
            this.attendanceFlushSuccess = true;
            setTimeout(() => {this.attendanceFlushSuccess = false}, 5000);
          }
        );
      }

    }

  }
}
