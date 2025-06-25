import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, map, Observable, of, shareReplay, finalize, tap, catchError, throwError } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../../chat/models/user.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {


  private apiUrl = environment.apiUrl + '/auth';
  private isAuthenticated = new BehaviorSubject<boolean>(false);
  private isBrowser: boolean;
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();



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

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('user_profile');
    if (userStr) {
      const user = JSON.parse(userStr);
      this.userSubject.next(user);
    }
  }

  // Get user profile
  getUserProfile(): Observable<User> {
    return this.httpClient.get<User>(`${environment.apiUrl}/auth/profile/`).pipe(
      tap((user: any) => {
        localStorage.setItem('user_profile', JSON.stringify(user));
        this.userSubject.next(user);
      })
    );
  }

  // Update user profile
  updateUserProfile(profileData: any): Observable<User> {
    return this.httpClient.put<User>(`${environment.apiUrl}/auth/profile/`, profileData).pipe(
      tap(updatedUser => {
        const currentUser = this.userSubject.value;
        const mergedUser = { ...currentUser, ...updatedUser };
        localStorage.setItem('user_profile', JSON.stringify(mergedUser));
        this.userSubject.next(mergedUser);
      })
    );
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
  emailVerification(token: any) {
    return this.httpClient.post(`${this.apiUrl}/verify-email/`, { token }).toPromise();
  }



  setAuthenticated(value: boolean): void {
    this.isAuthenticated.next(value);
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

  // Upload profile image
  uploadProfileImage(imageFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('profile_image', imageFile);

    return this.httpClient.put<any>(`${this.apiUrl}/profile/image/`, formData).pipe(
      tap(response => {
        const currentUser = this.userSubject.value;
        if (currentUser) {
          const updatedUser = { ...currentUser, profile_image: response.profile_image };
          localStorage.setItem('user_profile', JSON.stringify(updatedUser));
          this.userSubject.next(updatedUser);
        }
      })
    );
  }

  // Delete profile image
  deleteProfileImage(): Observable<any> {
    return this.httpClient.delete(`${this.apiUrl}/profile/image/`).pipe(
      tap(() => {
        const currentUser = this.userSubject.value;
        if (currentUser) {
          const updatedUser = { ...currentUser, profile_image: null };
          localStorage.setItem('user_profile', JSON.stringify(updatedUser));
          this.userSubject.next(updatedUser);
        }
      })
    );
  }

  // Change password
  changePassword(passwordData: { old_password: string, new_password: string }): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/change-password/`, passwordData);
  }

  requestPasswordReset(email: string): Observable<any> {
    // Replace with actual HTTP request implementation
    return this.httpClient.post(this.apiUrl + '/password-reset/', { email });
  }

  // Request password reset
  resetPassword(data: { token: string, new_password: string, email: string }): Observable<any> {
    return this.httpClient.post<any>(`${this.apiUrl}/password-reset/confirm/`, data)
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  /**
* Verify if a password reset token is valid
* @param token The password reset token to verify
* @returns An observable with the verification result
*/
  verifyResetToken(token: string): Observable<any> {
    return this.httpClient.post<any>(`${this.apiUrl}/verify-token/`, { token })
      .pipe(
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  requestForgotPassword(email: string) {
    return this.httpClient.post(`${this.apiUrl}/request-reset-password/`, { email });
  }

  // Delete account
  deleteAccount(): Observable<any> {
    return this.httpClient.delete(`${this.apiUrl}/profile/`).pipe(
      finalize(() => {
        if (this.isBrowser) {
          sessionStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_profile');
          this.isAuthenticated.next(false);
          this.userSubject.next(null);
        }
      })
    );
  }
}
