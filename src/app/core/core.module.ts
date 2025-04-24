import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { LoaderInterceptor } from './interceptor/loader.interceptor';
import { AuthInterceptor } from './interceptor/auth.interceptor';
import { AuthService } from '../auth/service/auth.service';

export function initializeApp(authService: AuthService) {
  return () => authService.initApp();
}

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
  ],
  providers: [
    ThemeService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      // deps: [AuthService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true
    }
  ],
  exports: []
})
export class CoreModule { }
