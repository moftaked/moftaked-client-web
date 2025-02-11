import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErrorMessageComponent } from '../error-message/error-message.component';
import { HttpErrorResponse } from '@angular/common/http';
import { SuccessMessageComponent } from '../success-message/success-message.component';
import { Location } from '@angular/common';
import { teacher, TeachersService } from '../services/teachers.service';
import { TeacherFormService } from './teacher-form.service';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [
    AppHeaderComponent,
    ReactiveFormsModule,
    ErrorMessageComponent,
    SuccessMessageComponent,
    NavMenuComponent
],
  templateUrl: './teacher-form.component.html',
  styleUrl: './teacher-form.component.css'
})
export class TeacherFormComponent implements OnInit{
  classId: string | null | undefined;
  teacherId: string | null | undefined;
  mode: 'edit' | 'add' = 'add';
  errorMessage = '';
  successMessage = '';
  deleteButtonText: 'امسح الخادم' | 'متأكد؟ اتكى تاني' = 'امسح الخادم'
  deleteErrorMessage = '';
  deleteSuccessMessage = '';
  deleteButtonClicksCount = 0;
  buttonDisabled = false;
  teacher: teacher = {
    teacher_id: 0,
    teacher_name: '',
    address: '',
    phone_numbers: '',
    district: '',
    notes: ''
  };
  teacherForm = new FormGroup({
    teacher_name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
    address: new FormControl('', [Validators.required, Validators.minLength(4), Validators.maxLength(1000)]),
    district: new FormControl('', [Validators.required, Validators.minLength(1), Validators.maxLength(50)]),
    phone_number: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.minLength(7), Validators.maxLength(15)]),
    second_phone_number: new FormControl('' , [Validators.pattern(/^[0-9]+$/), Validators.minLength(7), Validators.maxLength(15)]),
    notes: new FormControl('', [Validators.maxLength(255)])
  })

  constructor(
    private route: ActivatedRoute, 
    private teacherFormService: TeacherFormService,
    private router: Router,
    private teacherService: TeachersService,
    private location: Location,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId');
    this.teacherId = this.route.snapshot.paramMap.get('teacherId');
    if(this.classId != null){
      this.mode = 'add'
    }
    else if(this.teacherId != null){
      this.mode = 'edit'
    }

    if(this.mode == 'edit') {
      const observable = this.teacherService.getTeacher(this.teacherId);
      observable.subscribe({
        next: (res) => {
          if(res.body != undefined){
            this.teacher = res.body.teachers[0]
            const controls = this.teacherForm.controls;
            controls.teacher_name.setValue(this.teacher.teacher_name);
            controls.address.setValue(this.teacher.address);
            controls.district.setValue(this.teacher.district);
            if(this.teacher.notes)
              controls.notes.setValue(this.teacher.notes);
            const phoneNumbers = this.teacher.phone_numbers.split(', ');
            controls.phone_number.setValue(phoneNumbers[0]);
            if(phoneNumbers[1])
              controls.second_phone_number.setValue(phoneNumbers[1]);
          }
        },
        error: (error: HttpErrorResponse) => {
          if(error.status == 401){
            this.authService.markTokenInvalid();
            this.router.navigate(['/login'])
          }
          else if (error.status == 403)
            this.router.navigate(['/home'])
        }
      })
      
    }
  }

  onSubmit() {
    const controls = this.teacherForm.controls;
    if(this.teacherForm.valid == false) {
      if(controls.teacher_name.errors != null)
        this.errorMessage = 'اكتب اسم الخادم';
      else if(controls.address.errors != null)
        this.errorMessage = 'اكتب العنوان';
      else if(controls.district.errors != null)
        this.errorMessage = 'اكتب المنطقة';
      else if(controls.phone_number.errors != null)
        this.errorMessage = 'اكتب رقم التليفون صح (لازم ارقام انجليزي)';
      else if(controls.second_phone_number.errors != null)
        this.errorMessage = 'اكتب رقم التليفون التاني صح او امسحه (لازم ارقام انجليزي)';
      else if(controls.notes.errors != null)
        this.errorMessage = 'الملاحظات طويلة اوي لازم تكون اقل من 255 حرف';
    }

    else if(this.mode == 'add'){
      this.buttonDisabled = true;
      const observable = this.teacherFormService.createTeacher(
        this.teacherForm.value.teacher_name, 
        this.teacherForm.value.address, 
        this.teacherForm.value.phone_number, 
        this.teacherForm.value.second_phone_number, 
        this.teacherForm.value.district,
        this.teacherForm.value.notes,
        this.classId
      );
      observable.subscribe({
        next: (res) => {
          if (res.status == 201){
            this.buttonDisabled = false;
            this.teacherForm.reset();
            this.successMessage = 'البيانات اللي انت كتبتها اتسجلت بنجاح';
            this.errorMessage = '';
          }
          setTimeout(() => this.successMessage = '', 5000);
        },

        error: (err: HttpErrorResponse) => {
          this.buttonDisabled = false;
          if(err.status == 400)
            this.errorMessage = 'البيانات اللي انت كتبتها فيها حاجة غلط';
          else if(err.status == 401){
            this.authService.markTokenInvalid();
            this.router.navigate(['/login'])
          }
          else if (err.status == 403)
            this.router.navigate(['/home'])
          else
            this.errorMessage = 'حصل خطأ غير متوقع من فضلك كلم توني جورج';
        }
      })
    }
    else if(this.mode == 'edit'){
      this.buttonDisabled = true;
      const observable = this.teacherFormService.updateTeacher(
        this.teacherId,
        this.teacherForm.value.teacher_name, 
        this.teacherForm.value.address, 
        this.teacherForm.value.phone_number, 
        this.teacherForm.value.second_phone_number, 
        this.teacherForm.value.district,
        this.teacherForm.value.notes,
      );
      observable.subscribe({
        next: (res) => {
          if (res.status == 200){
            this.buttonDisabled = false;
            this.successMessage = 'التعديلات اللي انت عملتها اتسجلت بنجاح';
            this.errorMessage = '';
          }
          setTimeout(() => {this.successMessage = ''; this.location.back()}, 500);
        },

        error: (err: HttpErrorResponse) => {
          this.buttonDisabled = false;
          if(err.status == 400)
            this.errorMessage = 'البيانات اللي انت كتبتها فيها حاجة غلط';
          else if(err.status == 401){
            this.authService.markTokenInvalid();
            this.router.navigate(['/login'])
          }
          else
            this.errorMessage = 'حصل خطأ غير متوقع من فضلك كلم توني جورج';
        }
      })
    }
  }

  onDeleteButtonClick() {
    this.deleteButtonClicksCount++;
    if(this.deleteButtonClicksCount == 1){
      this.deleteButtonText = 'متأكد؟ اتكى تاني';
    }
    else if(this.teacherId && this.deleteButtonClicksCount > 1){
      const observable = this.teacherFormService.deleteTeacher(this.teacherId);
      observable.subscribe({
        next: (res) => {
          if(res.body?.affectedRows){
            this.deleteSuccessMessage = 'الخادم اتمسح بنجاح';
            setTimeout(() => {this.deleteSuccessMessage = ''; this.location.back()}, 2000);
          }
          else
            this.deleteErrorMessage = 'مفيش حاجة اتمسحت';
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 404)
            this.deleteErrorMessage = 'الخادم ده مش موجود حاليا';
          else if(err.status == 401){
            this.authService.markTokenInvalid();
            this.router.navigate(['/login'])
          }
          else
            this.deleteErrorMessage = 'حصل خطأ غير متوقع من فضلك كلم توني جورج';
        },
      })
    }
  }

}
