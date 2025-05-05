import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { from } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../service/auth.service';
import { Theme, ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  showPassword = false;
  isDarkMode = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService,
    private spinner: NgxSpinnerService,
    private themeService: ThemeService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    // Check the current theme
    this.isDarkMode = this.themeService.getCurrentTheme() === 'dark';

    // Subscribe to theme changes
    this.themeService.theme$.subscribe((theme: Theme) => {
      this.isDarkMode = theme === 'dark';
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }


  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }


  onSubmit() {
    if (this.loginForm.valid) {
      this.loading = true;
      this.spinner.show();
      this.errorMessage = null;

      from(
        this.authService.login(
          this.loginForm.value.username,
          this.loginForm.value.password,
        )
      ).subscribe(
        (response: any) => {
          this.loading = false;
          this.spinner.hide();
          this.toastr.success('Login successful!', response.message);
          this.router.navigate(['/home']);
        },
        (error: any) => {
          this.loading = false;
          this.spinner.hide();
          const errorDetail = error.error?.detail
            ? (Array.isArray(error.error.detail) ? error.error.detail[0] : error.error.detail)
            : 'Something went wrong. Please try again later.';
          this.errorMessage = errorDetail;
          this.toastr.error(errorDetail, 'Login Failed');
        }
      );
    } else {
      // Mark all form controls as touched to trigger validation messages
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }
}
