import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { classResultBody, ClassService, studentsResultBody } from './class.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { SuccessMessageComponent } from '../success-message/success-message.component';
import { student } from '../services/student.service';

@Component({
  selector: 'app-class',
  standalone: true,
  imports: [
    AppHeaderComponent,
    SuccessMessageComponent,
  ],
  templateUrl: './class.component.html',
  styleUrl: './class.component.css'
})
export class ClassComponent implements OnInit{
  id: string | null = '';
  name = '';
  totalCount = 0;
  students: student[] = [];
  studentsTableExpanded = false;
  attributes = new Map<string, keyof student>();
  attributesOptions = ['العنوان', 'رقم التليفون', 'المنطقة', 'ملاحظات'];
  attributesOptionsCurrentIndex = 1;
  currentAttributeRendered = this.attributesOptions[this.attributesOptionsCurrentIndex];
  currentAttributeActual: keyof student = 'phone_numbers';
  isEditActive = false;
  message = '';
  currentEditingStudent: student | undefined;
  
  constructor(private route: ActivatedRoute, private classService: ClassService, private router: Router) {}

  ngOnInit(): void {
    this.attributes.set('العنوان', 'address');
    this.attributes.set('رقم التليفون', 'phone_numbers');
    this.attributes.set('المنطقة', 'district');
    this.attributes.set('ملاحظات', 'notes');
    this.id = this.route.snapshot.paramMap.get('id');
    this.classService.getClassName(this.id).subscribe({
      next: (res: HttpResponse<classResultBody>) => {
        if(res.body)
          this.name = res.body[0].class_name;
          console.log(res)
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401)
          this.router.navigate(['/login'])
        console.log(err);
      }
    })

    this.classService.getStudents(this.id).subscribe({
      next: (res: HttpResponse<studentsResultBody>) => {
        if(res.body){
          this.totalCount = res.body.metadata[0].count;
          this.students = res.body.students;
          console.log(res)
        }
      },

      error: (err: HttpErrorResponse) => {
        if(err.status == 401)
          this.router.navigate(['/login'])
        else if(err.status == 403)
          this.router.navigate(['/home'])
        console.log(err);
      }
    })
  }

  navigateAttributesOptions(step: number) {
    this.attributesOptionsCurrentIndex = (this.attributesOptionsCurrentIndex + step) % this.attributesOptions.length;
    if(this.attributesOptionsCurrentIndex < 0)
      this.attributesOptionsCurrentIndex = this.attributesOptions.length - 1;
    this.currentAttributeRendered = this.attributesOptions[this.attributesOptionsCurrentIndex];
    const actual = this.attributes.get(this.currentAttributeRendered);
    if(actual != undefined)
      this.currentAttributeActual = actual;
  }

  onClickaddStudent() {
    this.router.navigate([`/class/${this.id}/add`])
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

  openEditDialog(studentId: number) {
    if(this.isEditActive)
      this.router.navigate([`/student/${studentId}/edit`])
  }

  toggleStudentsTable() {
    this.studentsTableExpanded = !this.studentsTableExpanded;
  }
}
