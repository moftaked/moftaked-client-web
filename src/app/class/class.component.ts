import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { classResultBody, ClassService, studentsResultBody, teachersResultBody } from './class.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { SuccessMessageComponent } from '../success-message/success-message.component';
import { student } from '../services/student.service';
import { teacher } from '../services/teachers.service';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";

@Component({
  selector: 'app-class',
  standalone: true,
  imports: [
    AppHeaderComponent,
    SuccessMessageComponent,
    NavMenuComponent,
],
  templateUrl: './class.component.html',
  styleUrl: './class.component.css'
})
export class ClassComponent implements OnInit{
  id: string | null = '';
  name = '';
  isUserLeader = false;
  studentsTotalCount = 0;
  teachersTotalCount = 0;
  students: student[] = [];
  teachers: teacher[] = []
  studentsTableExpanded = false;
  teachersTableExpanded = false;
  studentAttributes = new Map<string, keyof student>();
  teacherAttributes = new Map<string, keyof teacher>();
  attributesOptions = ['العنوان', 'رقم التليفون', 'المنطقة', 'ملاحظات'];
  studentAttributesOptionsCurrentIndex = 1;
  teacherAttributesOptionsCurrentIndex = 1;
  studentCurrentAttributeRendered = this.attributesOptions[this.studentAttributesOptionsCurrentIndex];
  teacherCurrentAttributeRendered = this.attributesOptions[this.studentAttributesOptionsCurrentIndex];
  studentCurrentAttributeActual: keyof student = 'phone_numbers';
  teacherCurrentAttributeActual: keyof teacher = 'phone_numbers';
  isEditActive = false;
  message = '';
  
  constructor(
    private route: ActivatedRoute, 
    private classService: ClassService, 
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.studentAttributes.set('العنوان', 'address');
    this.studentAttributes.set('رقم التليفون', 'phone_numbers');
    this.studentAttributes.set('المنطقة', 'district');
    this.studentAttributes.set('ملاحظات', 'notes');
    this.teacherAttributes.set('العنوان', 'address');
    this.teacherAttributes.set('رقم التليفون', 'phone_numbers');
    this.teacherAttributes.set('المنطقة', 'district');
    this.teacherAttributes.set('ملاحظات', 'notes');
    this.id = this.route.snapshot.paramMap.get('id');
    this.isUserLeader = this.authService.getRoles().some((role) => {return (role.class_id.toString() == this.id) && (role.role == 'leader' || role.role == 'manager')})
    this.classService.getClassName(this.id).subscribe({
      next: (res: HttpResponse<classResultBody>) => {
        if(res.body)
          this.name = res.body[0].class_name;
          console.log(res)
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401){
          this.authService.markTokenInvalid();
          this.router.navigate(['/login'])
        }
        console.log(err);
      }
    })

    this.classService.getStudents(this.id).subscribe({
      next: (res: HttpResponse<studentsResultBody>) => {
        if(res.body){
          this.studentsTotalCount = res.body.metadata[0].count;
          this.students = res.body.students;
          console.log(res)
        }
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401){
          this.authService.markTokenInvalid();
          this.router.navigate(['/login'])
        }
        else if(err.status == 403)
          this.router.navigate(['/home'])
        console.log(err);
      }
    })

    this.classService.getTeachers(this.id).subscribe({
      next: (res: HttpResponse<teachersResultBody>) => {
        if(res.body){
          this.teachersTotalCount = res.body.metadata[0].count;
          this.teachers = res.body.teachers;
          console.log(res)
        }
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401){
          this.authService.markTokenInvalid();
          this.router.navigate(['/login'])
        }
        console.log(err);
      }
    })
  }

  navigateStudentAttributesOptions(step: number) {
    this.studentAttributesOptionsCurrentIndex = (this.studentAttributesOptionsCurrentIndex + step) % this.attributesOptions.length;
    if(this.studentAttributesOptionsCurrentIndex < 0)
      this.studentAttributesOptionsCurrentIndex = this.attributesOptions.length - 1;
    this.studentCurrentAttributeRendered = this.attributesOptions[this.studentAttributesOptionsCurrentIndex];
    const actual = this.studentAttributes.get(this.studentCurrentAttributeRendered);
    if(actual != undefined)
      this.studentCurrentAttributeActual = actual;
  }

  navigateTeacherAttributesOptions(step: number) {
    this.teacherAttributesOptionsCurrentIndex = (this.teacherAttributesOptionsCurrentIndex + step) % this.attributesOptions.length;
    if(this.teacherAttributesOptionsCurrentIndex < 0)
      this.teacherAttributesOptionsCurrentIndex = this.attributesOptions.length - 1;
    this.teacherCurrentAttributeRendered = this.attributesOptions[this.teacherAttributesOptionsCurrentIndex];
    const actual = this.teacherAttributes.get(this.teacherCurrentAttributeRendered);
    if(actual != undefined)
      this.teacherCurrentAttributeActual = actual;
  }

  onClickaddStudent() {
    this.router.navigate([`/class/${this.id}/students/add`])
  }

  onClickaddTeacher() {
    this.router.navigate([`/class/${this.id}/teachers/add`])
  }

  onClickEvents() {
    this.router.navigate([`/class/${this.id}/events`])
  }
  
  onClickEditStudent() {
    this.isEditActive = !(this.isEditActive);
    if(this.isEditActive)
      this.message = 'وضع التعديل مفعل، دوس على اسم اللي انت عايز تعدل بياناته';
    else
      this.message = '';
  }

  openEditDialog(personId: number, type: 'student' | 'teacher') {
    if(this.isEditActive == false)
      return;
    if(type == 'teacher')
      this.router.navigate([`/teacher/${personId}/edit`])
    else if(type == 'student')
      this.router.navigate([`/student/${personId}/edit`])
  }

  toggleStudentsTable() {
    this.studentsTableExpanded = !this.studentsTableExpanded;
  }

  toggleTeachersTable() {
    this.teachersTableExpanded = !this.teachersTableExpanded;
  }
}
