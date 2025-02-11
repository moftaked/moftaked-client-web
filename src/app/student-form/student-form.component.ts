import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppHeaderComponent } from "../app-header/app-header.component";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErrorMessageComponent } from '../error-message/error-message.component';
import { StudentFormService } from './student-form.service';
import { HttpErrorResponse } from '@angular/common/http';
import { SuccessMessageComponent } from '../success-message/success-message.component';
import { student, StudentService } from '../services/student.service';
import { Location } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { NavMenuComponent } from "../nav-menu/nav-menu.component";

@Component({
  selector: 'app-student-form',
  standalone: true,
  imports: [
    AppHeaderComponent,
    ReactiveFormsModule,
    ErrorMessageComponent,
    SuccessMessageComponent,
    NavMenuComponent
],
  templateUrl: './student-form.component.html',
  styleUrls: ['./student-form.component.css']
})
export class StudentFormComponent implements OnInit{
  loading = false;
  classId: string | null | undefined;
  studentId: string | null | undefined;
  mode: 'edit' | 'add' = 'add';
  errorMessage = '';
  successMessage = '';
  deleteButtonText: 'امسح المخدوم' | 'متأكد؟ اتكى تاني' = 'امسح المخدوم'
  deleteErrorMessage = '';
  deleteSuccessMessage = '';
  deleteButtonClicksCount = 0;
  buttonDisabled = false;
  student: student = {
    student_id: 0,
    student_name: '',
    address: '',
    phone_numbers: '',
    district: '',
    notes: ''
  };
  studentForm = new FormGroup({
    student_name: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
    address: new FormControl('', [Validators.required, Validators.minLength(4), Validators.maxLength(1000)]),
    district: new FormControl('', [Validators.required, Validators.minLength(1), Validators.maxLength(50)]),
    phone_number: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.minLength(7), Validators.maxLength(15)]),
    second_phone_number: new FormControl('' , [Validators.pattern(/^[0-9]+$/), Validators.minLength(7), Validators.maxLength(15)]),
    notes: new FormControl('', [Validators.maxLength(255)])
  })

  constructor(
    private route: ActivatedRoute, 
    private studentFormService: StudentFormService,
    private router: Router,
    private studentService: StudentService,
    private location: Location,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId');
    this.studentId = this.route.snapshot.paramMap.get('studentId');

    if (!this.studentId) {
      this.mode = 'add'
    } else {
      this.mode = 'edit'
    }

    if (this.mode === 'edit') {
      const observable = this.studentService.getStudent(this.studentId);
      observable.subscribe({
        next: (res) => {
          if(res.body != undefined){
            this.student = res.body.students[0]
            const controls = this.studentForm.controls;
            controls.student_name.setValue(this.student.student_name);
            controls.address.setValue(this.student.address);
            controls.district.setValue(this.student.district);
            if(this.student.notes)
              controls.notes.setValue(this.student.notes);
            const phoneNumbers = this.student.phone_numbers.split(', ');
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
    const controls = this.studentForm.controls;
    if(this.studentForm.valid == false) {
      if(controls.student_name.errors != null)
        this.errorMessage = 'اكتب اسم المخدوم';
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
      const observable = this.studentFormService.createStudent(
        this.studentForm.value.student_name, 
        this.studentForm.value.address, 
        this.studentForm.value.phone_number, 
        this.studentForm.value.second_phone_number, 
        this.studentForm.value.district,
        this.studentForm.value.notes,
        this.classId
      );
      this.loading = true;
      observable.subscribe({
        next: (res) => {
          this.loading = false;
          if (res.status == 201){
            this.buttonDisabled = false;
            this.studentForm.reset();
            this.successMessage = 'البيانات اللي انت كتبتها اتسجلت بنجاح';
            this.errorMessage = '';
          }
          setTimeout(() => this.successMessage = '', 5000);
        },

        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.buttonDisabled = false;
          if(err.status == 400)
            this.errorMessage = 'البيانات اللي انت كتبتها فيها حاجة غلط';
          if(err.status == 401){
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
      const observable = this.studentFormService.updateStudent(
        this.studentId,
        this.studentForm.value.student_name, 
        this.studentForm.value.address, 
        this.studentForm.value.phone_number, 
        this.studentForm.value.second_phone_number, 
        this.studentForm.value.district,
        this.studentForm.value.notes,
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
          if(err.status == 401){
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
    else if(this.studentId && this.deleteButtonClicksCount > 1){
      const observable = this.studentFormService.deleteStudent(this.studentId);
      observable.subscribe({
        next: (res) => {
          if(res.body?.affectedRows){
            this.deleteSuccessMessage = 'المخدوم اتمسح بنجاح';
            setTimeout(() => {this.deleteSuccessMessage = ''; this.location.back()}, 2000);
          }
          else
            this.deleteErrorMessage = 'مفيش حاجة اتمسحت';
        },
        error: (err: HttpErrorResponse) => {
          if(err.status == 404)
            this.deleteErrorMessage = 'المخدوم ده مش موجود حاليا';
          if(err.status == 401){
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
