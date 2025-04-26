import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/service/auth.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-forgotten-password',
  templateUrl: './forgotten-password.component.html',
  styleUrls: ['./forgotten-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgottenPasswordComponent implements OnInit {
  forgotPasswordForm!: FormGroup;
  resetSuccess: boolean = false;
  resetError: string | null = null;
  isSubmitting: boolean = false;
  isDarkMode: boolean = false;
  countdown: number = 5;
  private countdownInterval: any;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.setupThemeListener();
    this.checkEmailFromQueryParams();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  initForm(): void {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  setupThemeListener(): void {
    this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.detectChanges();
    });
  }

  checkEmailFromQueryParams(): void {
    // Check if email was passed as query parameter (e.g., from login page)
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    if (email) {
      this.forgotPasswordForm.patchValue({ email });
      this.cdr.detectChanges();
    }
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid || this.isSubmitting) return;

    const email = this.forgotPasswordForm.get('email')?.value;

    // Show loading indicators
    this.isSubmitting = true;
    this.resetSuccess = false;
    this.resetError = null;
    this.spinner.show();

    this.authService.requestForgotPassword(email).pipe(
      finalize(() => {
        this.isSubmitting = false;
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.resetSuccess = true;
        this.forgotPasswordForm.reset();
        this.startCountdown();
      },
      error: (error: any) => {
        const errorMessage = error.error?.detail || 'Failed to send password reset email. Please try again later.';
        this.resetError = errorMessage;

        // Log error for debugging
        console.error('Password reset error:', error);
      }
    });
  }

  startCountdown(): void {
    this.countdown = 5;
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      this.cdr.detectChanges();

      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.navigateToLogin();
      }
    }, 1000);
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  toggleTheme(): void {
    this.themeService.toggleDarkMode();
  }

  // Method to validate email field and show appropriate error message
  getEmailErrorMessage(): string {
    const emailControl = this.forgotPasswordForm.get('email');
    if (emailControl?.hasError('required')) {
      return 'Email is required';
    }
    if (emailControl?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }
}
