import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { AuthService, loginResultBody } from '../auth/auth.service';
import { Observable } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ErrorMessageComponent } from '../error-message/error-message.component';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../services/user.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ErrorMessageComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  constructor(
    private authService: AuthService, 
    private router: Router, 
    private route: ActivatedRoute,
    private userService: UserService
  ) {}
  errorMessages = {
    invalidInput: 
    `يا سيدي الفاضل
    اكتب بياناتك فوق
    عشان تخش جوا`,
    tooManyRequests:
    `هدي اعصابك براحة خالص
    استنى شوية وحاول تاني`,
    wrongCredentials:
    `الباسورد او اسم المستخدم
    انت كتبتهم غلط
    معلش حاول تاني`,
    unexpectedError:
    `حصل خطأ غير متوقع
    من فضلك كلم توني جورج`
  }
  
  errorMessage = '';
  
  loginForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.min(4), Validators.max(50)]),
    password: new FormControl('', [Validators.required, Validators.min(8)])
  })
  

  onSubmit() {
    let observable: Observable<HttpResponse<loginResultBody>>;
    if(this.loginForm.valid == false) {
      this.errorMessage = this.errorMessages.invalidInput;
    }

    else {
      observable = this.authService.login(this.loginForm.value.username, this.loginForm.value.password);
      observable.subscribe({
        next: (res: HttpResponse<loginResultBody>) => {
          if(typeof res.body?.access_token == 'string'){
            console.log(`access token: ${res.body?.access_token}`)
            this.authService.setJwt(res.body?.access_token);
          }
          if(typeof res.body?.user_id == 'number'){
            console.log(`user id: ${res.body?.user_id}`);
            this.userService.setUserId(res.body?.user_id);
          }
          this.router.navigate(['/home'])
        },

        error: (err: HttpErrorResponse) => {
          if(err.status == 400)
            this.errorMessage = this.errorMessages.invalidInput;
          else if (err.status == 401)
            this.errorMessage = this.errorMessages.wrongCredentials;
          else if (err.status == 429)
            this.errorMessage = this.errorMessages.tooManyRequests;
          else
            this.errorMessage = this.errorMessages.unexpectedError;
        }
      })
    }

  }
}
