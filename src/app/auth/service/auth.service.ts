import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/auth';

  constructor(private httpClient: HttpClient) {}

  // Login method
  login(username: string, password: string): Observable<any>  {
    return this.httpClient.post(`${this.apiUrl}/login/`, { username, password }).pipe(
      map((response: any) => {

        const { access, refresh } = response;

        // Store access token in sessionStorage (valid for this session)
        sessionStorage.setItem('access_token', access);

        // Store refresh token in localStorage (persists across sessions)
        localStorage.setItem('refresh_token', refresh);

        // Store user profile in localStorage (persists across sessions)
        localStorage.setItem('userProfile', JSON.stringify(response.user));
        console.log(response);

        return response;
      })
    );
  }

  isLoggedIn(){
    return this.getAccessToken() !== null;
  }

  // Register method
  register(data: any) {
    return this.httpClient.post(`${this.apiUrl}/register/`, data)
      .toPromise()
      .then((response: any) => {
        const { user } = response as any;

        // Store access token in sessionStorage (valid for this session)
        sessionStorage.setItem('access_token', user.access);

        // Store refresh token in localStorage (persists across sessions)
        localStorage.setItem('refresh_token', user.refresh);

        // Store user profile in localStorage (persists across sessions)
        localStorage.setItem('user_profile', JSON.stringify(response.user));

        return response;
      });
  }

  // Get access token from sessionStorage
  getAccessToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  // Logout method: Clear sessionStorage and localStorage
  logout() {
    const payload = {
      "refresh": localStorage.getItem('refresh_token')
    }
    return this.httpClient.post(`${this.apiUrl}/logout/`, payload)
  }

  emailVerification(token: any){
    return this.httpClient.post(`${this.apiUrl}/verify-email/`, { token }).toPromise();
  }

}
