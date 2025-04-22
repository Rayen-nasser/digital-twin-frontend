import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, map, Observable, of, shareReplay, finalize } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/auth';
  private isAuthenticated = new BehaviorSubject<boolean>(false);
  private isBrowser: boolean;

  // Request deduplication
  private pendingVerifications = new Map<string, Observable<any>>();

  constructor(
    private httpClient: HttpClient,
    private spinner: NgxSpinnerService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Only check authentication if in browser environment
    if (this.isBrowser) {
      this.isAuthenticated.next(!!this.getAccessToken());
    } else {
      this.isAuthenticated.next(false);
    }
  }

  // Login method
  login(username: string, password: string): Observable<any> {
    return this.httpClient
      .post(`${this.apiUrl}/login/`, { username, password })
      .pipe(
        map((response: any) => {
          const { access, refresh } = response;

          if (this.isBrowser) {
            // Store access token in sessionStorage (valid for this session)
            sessionStorage.setItem('access_token', access);

            // Store refresh token in localStorage (persists across sessions)
            localStorage.setItem('refresh_token', refresh);

            // Store user profile in localStorage (persists across sessions)
            localStorage.setItem('user_profile', JSON.stringify(response.user));
          }

          this.setAuthenticated(true);
          return response;
        })
      );
  }

  refreshToken(): Observable<any> {
    if (!this.isBrowser) {
      return of({ access: null });
    }

    const refresh = this.getRefreshToken();
    if (!refresh) {
      return of({ access: null });
    }

    return this.httpClient
      .post(`${this.apiUrl}/token/refresh/`, { refresh })
      .pipe(
        map((res: any) => {
          const access = res.access;
          if (access && this.isBrowser) {
            sessionStorage.setItem('access_token', access);
            this.setAuthenticated(true);
          }
          return res;
        })
      );
  }

  initApp(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isBrowser) {
        resolve();
        return;
      }

      const accessToken = this.getAccessToken();
      const refreshToken = this.getRefreshToken();

      if (!accessToken && refreshToken) {
        this.spinner.show(); // Show spinner manually at init
        this.refreshToken().subscribe({
          next: (res) => {
            if (this.isBrowser && res.access) {
              sessionStorage.setItem('access_token', res.access);
              this.setAuthenticated(true);
            }
            this.spinner.hide(); // Hide spinner after success
            resolve();
          },
          error: () => {
            this.logout().subscribe(() => {
              this.spinner.hide(); // Hide spinner on error
              resolve();
            });
          }
        });
      } else {
        resolve(); // Continue app
      }
    });
  }

  isLoggedIn(): boolean {
    return this.isBrowser && this.getAccessToken() !== null;
  }

  // Register method
  register(data: any): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/register/`, data);
  }

  getAccessToken(): string | null {
    return this.isBrowser ? sessionStorage.getItem('access_token') : null;
  }

  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem('refresh_token') : null;
  }

  // Logout method: Clear sessionStorage and localStorage
  logout(): Observable<any> {
    const payload = {
      refresh: this.isBrowser ? localStorage.getItem('refresh_token') : null,
    };

    this.isAuthenticated.next(false);

    if (this.isBrowser) {
      sessionStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_profile');
    }

    return this.httpClient.post(`${this.apiUrl}/logout/`, payload);
  }

  // Email verification with request deduplication
  emailVerification(token: string): Observable<any> {
    console.log('Email verification requested for token:', token);

    // Check if this verification is already in progress
    if (this.pendingVerifications.has(token)) {
      console.log('Reusing existing verification request for token');
      return this.pendingVerifications.get(token)!;
    }

    return this.httpClient.post(`${this.apiUrl}/verify-email/`, { token: token });
  }

  setAuthenticated(value: boolean): void {
    this.isAuthenticated.next(value);
  }

  getAuthStatus(): Observable<boolean> {
    return this.isAuthenticated.asObservable();
  }

  // Resend verification email
  resendVerificationEmail(email: string): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/resend-verification/`, { email });
  }

  // Store pending verification email
  storePendingVerification(email: string): void {
    if (this.isBrowser) {
      localStorage.setItem('pending_verification_email', email);
    }
  }

  // Check if user is authenticated but not verified
  isAuthenticatedButNotVerified(): boolean {
    if (!this.isBrowser) return false;

    const userProfile = localStorage.getItem('user_profile');
    if (!userProfile) return false;

    const user = JSON.parse(userProfile);
    return this.isAuthenticated.value && user.is_verified === false;
  }
}
