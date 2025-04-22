import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    let modifiedReq = req;

    // Only access sessionStorage if in browser context
    if (isPlatformBrowser(this.platformId)) {
      const token = sessionStorage.getItem('access_token'); // Or use a service

      if (token) {
        console.log(`Bearer ${token}`);
        modifiedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    }

    return next.handle(modifiedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Optional: Handle errors globally
        if (error.status === 401) {
          console.error('Unauthorized - maybe redirect to login');
        }
        return throwError(() => error);
      })
    );
  }
}
