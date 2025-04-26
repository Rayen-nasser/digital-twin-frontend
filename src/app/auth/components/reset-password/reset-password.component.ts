import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../auth/service/auth.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  resetPasswordForm!: FormGroup;
  token: string | null = null;
  resetSuccess: boolean = false;
  resetError: string | null = null;
  isSubmitting: boolean = false;
  isDarkMode: boolean = false;
  countdown: number = 5;
  private countdownInterval: any;
  passwordVisible: boolean = false;
  confirmPasswordVisible: boolean = false;
  isVerifyingToken: boolean = true; // Add flag for token verification state

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private spinner: NgxSpinnerService,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.setupThemeListener();
    this.getTokenFromRoute();
    this.initForm();

    // Verify token if it exists
    if (this.token) {
      this.verifyToken();
    } else {
      this.isVerifyingToken = false;
    }
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  setupThemeListener(): void {
    this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.detectChanges();
    });
  }

  getTokenFromRoute(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.resetError = 'Invalid or missing password reset token. Please request a new password reset link.';
      this.cdr.detectChanges();
    }
  }

  // Add method to verify token with backend
  verifyToken(): void {
    this.isVerifyingToken = true;
    this.spinner.show();

    // Get email from localStorage if available
    let email;
    try {
      const userProfile = localStorage.getItem('user_profile');
      email = userProfile ? JSON.parse(userProfile).email : null;
    } catch (e) {
      console.error('Error parsing user profile:', e);
      email = null;
    }

    // Call the auth service to verify the token
    this.authService.verifyResetToken(this.token!).pipe(
      finalize(() => {
        this.isVerifyingToken = false;
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        // Token is valid, continue with reset password form
        console.log('Token verified successfully');
      },
      error: (error) => {
        // Token is invalid, show error and reset token
        this.token = null;
        this.resetError = error.error?.error || 'Invalid or expired password reset token. Please request a new reset link.';
        console.error('Token verification error:', error);
      }
    });
  }

  initForm(): void {
    this.resetPasswordForm = this.fb.group({
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('new_password')?.value;
    const confirmPassword = form.get('confirm_password')?.value;

    if (password !== confirmPassword) {
      form.get('confirm_password')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      return null;
    }
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid || this.isSubmitting || !this.token) return;

    const newPassword = this.resetPasswordForm.get('new_password')?.value;

    // Try to get email from localStorage, but make it work even if not available
    let email;
    try {
      const userProfile = localStorage.getItem('user_profile');
      email = userProfile ? JSON.parse(userProfile).email : null;
    } catch (e) {
      console.error('Error parsing user profile:', e);
      email = null;
    }

    this.isSubmitting = true;
    this.resetSuccess = false;
    this.resetError = null;
    this.spinner.show();

    this.authService.resetPassword({
      token: this.token,
      new_password: newPassword,
      email
    }).pipe(
      finalize(() => {
        this.isSubmitting = false;
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.resetSuccess = true;
        this.resetPasswordForm.reset();
        this.startCountdown();
      },
      error: (error) => {
        this.resetError = error.error?.error || 'Failed to reset password. Please try again or request a new reset link.';
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

  navigateToForgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  toggleTheme(): void {
    this.themeService.toggleDarkMode();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
    this.cdr.detectChanges();
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
    this.cdr.detectChanges();
  }

  getPasswordErrorMessage(): string {
    const passwordControl = this.resetPasswordForm.get('new_password');
    if (passwordControl?.hasError('required')) {
      return 'Password is required';
    }
    if (passwordControl?.hasError('minlength')) {
      return 'Password must be at least 8 characters long';
    }
    return '';
  }

  getConfirmPasswordErrorMessage(): string {
    const confirmPasswordControl = this.resetPasswordForm.get('confirm_password');
    if (confirmPasswordControl?.hasError('required')) {
      return 'Please confirm your password';
    }
    if (confirmPasswordControl?.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    return '';
  }
}
