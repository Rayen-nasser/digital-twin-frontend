import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { from } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false; // To manage loading state
  errorMessage: string | null = null; // To show error messages

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService,
    private spinner: NgxSpinnerService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.spinner.show()
      this.errorMessage = null; // Reset the error message
      from(
        this.authService.login(
          this.loginForm.value.username,
          this.loginForm.value.password
        )
      ).subscribe(
        (response: any) => {
          this.spinner.hide()
          // Show success toast message
          this.toastr.success('Login successful!', response.message);
          // Navigate to the dashboard or another page
          this.router.navigate(['/home']);
        },
        (error: any) => {
          this.spinner.hide();
          const errorDetail = error.error?.detail ? error?.error.detail[0] : 'Something went wrong. Please try again later.';
          this.toastr.error(errorDetail, 'Login Failed');
        }
      );
    }
  }
}
