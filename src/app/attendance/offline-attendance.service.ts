import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class OfflineAttendanceService {
  getOfflineAttendance(classId: number, eventId: number, type: 'students' | 'teachers' | undefined) {
    const result: {attended: Set<number>, absent: Set<number>, isEmpty: boolean} = {
        attended: new Set(),
        absent: new Set(),
        isEmpty: true
    };

    const dirtyAttendanceJSON = localStorage.getItem(this.getlocalAttendanceKey(classId, eventId, type));
    if(dirtyAttendanceJSON != null) {
      let {absent, attended} = JSON.parse(dirtyAttendanceJSON);
      result.attended = new Set(attended);
      result.absent = new Set(absent);
      result.isEmpty = false;
    }
    return result;
  }

  getlocalAttendanceKey(classId: number, eventId: number, type: 'students' | 'teachers' | undefined) {
    return `attendanceC${classId}E${eventId}${type == 'students'? 's': 't'}`;
  }

  localSave(
    attended: Set<number>,
    absent: Set<number>,
    classId: number, 
    eventId: number, 
    type: 'students' | 'teachers' | undefined
  ) {
    localStorage.setItem(this.getlocalAttendanceKey(classId, eventId, type), JSON.stringify({absent: [...absent.keys()], attended: [...attended.keys()]}));
  }

  clear(classId: number, eventId: number, type: 'students' | 'teachers' | undefined) {
    localStorage.removeItem(this.getlocalAttendanceKey(classId, eventId, type));
  }
}