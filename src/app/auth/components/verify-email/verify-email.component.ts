import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../service/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit {
  loading = true;
  success = false;
  error = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private toasterService: ToastrService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');


    try {
      const res: any = await this.authService.emailVerification(token);

      // Optional: If the response contains tokens, store them
      if (res.access && res.refresh) {
        sessionStorage.setItem('access_token', res.access);
        localStorage.setItem('refresh_token', res.refresh);
      }

      if (res.user) {
        localStorage.setItem('user_profile', JSON.stringify(res.user));
      }

      this.loading = false;
      this.success = true;

      setTimeout(() => {
        this.router.navigate(['/profile']); // Or navigate to login/home/dashboard
      }, 3000);

    } catch (err) {
      console.error(err);
      this.loading = false;
      this.error = true;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
