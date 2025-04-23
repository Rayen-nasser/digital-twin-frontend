import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { NgxSpinnerService } from 'ngx-spinner';
import { timer } from 'rxjs';
import { first, take } from 'rxjs/operators';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss'],
})
export class VerifyEmailComponent implements OnInit {
  loading = true;
  success = false;
  error = false;
  showConfetti = false;
  errorMessage = '';

  // For countdown timer to dashboard redirect
  redirectSeconds = 5;
  redirectCountdown = this.redirectSeconds;

  // For pending verification instructions (when no token in URL)
  pendingVerification = false;
  userEmail = '';

  // Static flag to prevent duplicate verification attempts
  // This ensures verification happens only once even if ngOnInit is called multiple times
  static verificationAttempted = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.spinner.hide();
    const token = this.route.snapshot.queryParamMap.get('token');

    // If no token, show pending verification
    if (!token) {
      this.loading = false;
      this.pendingVerification = true;

      if (typeof window !== 'undefined') {
        this.userEmail = localStorage.getItem('pending_verification_email') || '';
      }
      return;
    }

    // Check if verification was already attempted with this token
    // Using static class property to ensure it persists even if component is recreated
    if (VerifyEmailComponent.verificationAttempted) {
      this.loading = false;
      return;
    }

    // Mark that verification has been attempted for this token
    VerifyEmailComponent.verificationAttempted = true;

    // Proceed with verification
    this.verifyEmail(token);
  }

  verifyEmail(token: string) {
    // Actual verification logic moved to separate method
    this.authService.emailVerification(token)
      .then((res: any) => {
        if (typeof window !== 'undefined') {
          if (res.tokens.access && res.tokens.refresh) {
            sessionStorage.setItem('access_token', res.tokens.access);
            localStorage.setItem('refresh_token', res.tokens.refresh);
            this.authService.setAuthenticated(true);
          }

          localStorage.removeItem('pending_verification_email');
          this.startRedirectCountdown();
        }

        this.loading = false;
        this.success = true;
        this.showConfetti = true;
        // this.toastr.success(
        //   res.message,
        //   'Success'
        // );
      })
      .catch((err: any) => {
        const message =
          err.error?.message ||
          'Verification failed. The link may be invalid or expired.';
        this.setError(message);
      });
  }

  setError(message: string) {
    this.loading = false;
    this.error = true;
    this.errorMessage = message;
    this.toastr.error(this.errorMessage, 'Verification Failed');
  }

  goHome() {
    this.router.navigate(['/home']);
  }

  goDashboard() {
    this.router.navigate(['/home']);
  }

  async resendVerification() {
    this.loading = true;

    try {
      const userEmail =
        localStorage.getItem('pending_verification_email') || this.userEmail;
      if (!userEmail) {
        this.loading = false;
        this.toastr.error(
          'No email found. Please return to registration',
          'Error'
        );
        return;
      }

      await this.authService.resendVerificationEmail(userEmail);
      this.toastr.success(
        'A new verification email has been sent',
        'Email Sent'
      );
      this.loading = false;

      // If we're on the pending page, show confirmation
      if (this.pendingVerification) {
        this.userEmail = userEmail;
      }
    } catch (err: any) {
      const message =
        err.error?.message || 'Failed to resend verification email';
      this.toastr.error(message, 'Error');
      this.loading = false;
    }
  }

  // Start countdown timer for redirect
  startRedirectCountdown() {
    timer(0, 1000)
      .pipe(take(this.redirectSeconds + 1))
      .subscribe((count) => {
        this.redirectCountdown = this.redirectSeconds - count;
        if (count === this.redirectSeconds) {
          this.router.navigate(['/home']);
        }
      });
  }

  // For pending verification view, go to login
  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
