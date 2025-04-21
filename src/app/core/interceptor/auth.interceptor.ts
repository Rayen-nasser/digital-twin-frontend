import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = sessionStorage.getItem('access_token'); // Or use a service

    let modifiedReq = req;
    console.log(`Bearer ${token}`);

    if (token) {
      modifiedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
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
