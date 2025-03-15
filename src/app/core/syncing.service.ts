import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Class } from '../services/user.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ClassService } from '../class/class.service';
import { EventsPageService, eventsResultBody } from '../events/events-page.service';
import { HttpResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SyncingService {

  private isDataSynced = false;
  studentSyncingCompleted = false;
  teacherSyncingCompleted = false;

  constructor(
    private snackBar: MatSnackBar, 
    private attendanceService: AttendanceService,
    private classService: ClassService,
    private eventsPageServices: EventsPageService
  ) { }

  syncData(classes: Class[]) {
    if(this.isDataSynced) // todo: add "|| isOffline"
      return;
    this.snackBar.open('من فضلك متقفلش الابلكيشن بنحدثلك البيانات', undefined, {
      duration: NaN,
      verticalPosition: 'top',
      horizontalPosition: 'center',
      direction: 'rtl'
    });
    this.attendanceSyncingClassIterator(classes, 0);
  }
  
  attendanceSyncingStudentsIterator(classes: Class[], classIndex: number, studentEvents: [{event_id: number, event_name: string}], studentsEventsIndex: number) {
    this.attendanceService.getStudentsEventName(classes[classIndex].class_id, studentEvents[studentsEventsIndex].event_id).subscribe(() => {
      this.attendanceService.getStudentAttendees(classes[classIndex].class_id, studentEvents[studentsEventsIndex].event_id).subscribe(() => {
        if(studentsEventsIndex + 1 < studentEvents.length)
          this.attendanceSyncingStudentsIterator(classes, classIndex, studentEvents, studentsEventsIndex + 1);
        else {
          this.studentSyncingCompleted = true;
          if(this.studentSyncingCompleted && this.teacherSyncingCompleted) {
            this.attendanceSyncingClassIterator(classes, classIndex + 1);
            this.studentSyncingCompleted = this.teacherSyncingCompleted = false;
          }
        }
      });
    });
  };

  attendanceSyncingTeachersIterator(classes: Class[], classIndex: number, teachersEvents: [{event_id: number, event_name: string}], teachersEventsIndex: number) {
    this.attendanceService.getTeachersEventName(classes[classIndex].class_id, teachersEvents[teachersEventsIndex].event_id).subscribe(() => {
      this.attendanceService.getTeachersAttendees(classes[classIndex].class_id, teachersEvents[teachersEventsIndex].event_id).subscribe(() => {
        if(teachersEventsIndex + 1 < teachersEvents.length)
          this.attendanceSyncingTeachersIterator(classes, classIndex, teachersEvents, teachersEventsIndex + 1);
        else {
          this.teacherSyncingCompleted = true;
          if(this.studentSyncingCompleted && this.teacherSyncingCompleted) {
            this.attendanceSyncingClassIterator(classes, classIndex + 1);
            this.studentSyncingCompleted = this.teacherSyncingCompleted = false;
          }
        }
      });
    });
  };

  attendanceSyncingClassIterator(classes: Class[], classIndex: number) {
    if (classIndex >= classes.length) {
      this.snackBar.open('حدثنالك بيانات الغياب', 'تمام', {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center',
        direction: 'rtl',
      })
      this.isDataSynced = true;
      return;
    }
    this.classService.getClassName(classes[classIndex].class_id).subscribe();
    this.eventsPageServices.getStudentsServices(classes[classIndex].class_id.toString()).subscribe({
      next: (res: HttpResponse<eventsResultBody>) => {
        if(res.body == undefined)
          return;
        let studentEvents = res.body.events;
        this.attendanceSyncingStudentsIterator(classes, classIndex, studentEvents, 0);
      }
    });
    this.eventsPageServices.getTeachersServices(classes[classIndex].class_id.toString()).subscribe({
      next: (res: HttpResponse<eventsResultBody>) => {
        if(res.body == undefined)
          return;
        let teachersEvents = res.body.events;
        this.attendanceSyncingTeachersIterator(classes, classIndex, teachersEvents, 0);
      }
    })
  }
}
