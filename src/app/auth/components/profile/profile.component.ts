// profile.component.ts
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/service/auth.service';
import { Theme, ThemeService } from '../../../core/services/theme.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import { User } from '../../../chat/models/user.interface';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  isDarkMode: boolean = false;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  activeTab: 'profile' | 'security' = 'profile';
  isEditing: boolean = false;
  imagePreview: string | ArrayBuffer | null = null;
  imageFile: File | null = null;
  updateSuccess: boolean = false;
  updateError: string | null = null;
  passwordSuccess: boolean = false;
  passwordError: string | null = null;
  isImageLoading: boolean = false;
  isImageDeleting: boolean = false;
  @ViewChild('fileInput') fileInput!: ElementRef;
  isSubmitting: boolean = false;

  constructor(
    private authService: AuthService,
    private themeService: ThemeService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {

    // Subscribe to user updates
    this.authService.user$.subscribe(user => {
      this.user = user;
      this.imagePreview = this.user?.profile_image || null;
      this.initForms();
      this.cdr.detectChanges();
    });

    // Load user profile if not available
    if (!this.user) {
      this.loadUserProfile();
    }

    this.themeService.theme$.subscribe((theme: Theme) => {
      this.isDarkMode = theme === 'dark';
      this.cdr.detectChanges();
    });

    this.initForms();
  }

  loadUserProfile(): void {
    this.spinner.show();

    this.authService.getUserProfile().pipe(
      finalize(() => {
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      error: (error) => {
        console.error('Error fetching user profile:', error);
        if (error.status === 401) {
          this.authService.logout().subscribe(() => {
            this.router.navigate(['/auth/login']);
          });
        }
      }
    });
  }

  initForms(): void {
    if (!this.user) return;

    this.profileForm = this.fb.group({
      username: [this.user.username, [Validators.required]],
      email: [{ value: this.user.email, disabled: true }],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
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

  changeTab(tab: 'profile' | 'security'): void {
    this.activeTab = tab;
    // Reset forms and states when changing tabs
    this.updateSuccess = false;
    this.updateError = null;
    this.passwordSuccess = false;
    this.passwordError = null;

    if (tab === 'profile' && this.isEditing) {
      this.cancelEdit();
    }

    this.cdr.detectChanges();
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.initForms();
      this.imageFile = null;
      this.imagePreview = this.user?.profile_image || null;
    }
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.initForms();
    this.imageFile = null;
    this.imagePreview = this.user?.profile_image || null;
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.updateError = 'Image size must be less than 5MB';
        this.cdr.detectChanges();
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        this.updateError = 'Only image files are allowed';
        this.cdr.detectChanges();
        return;
      }

      this.imageFile = file;

      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(this.imageFile);
    }
  }

  uploadProfileImage(): void {
    if (!this.imageFile) return;

    this.isImageLoading = true;
    this.updateError = null;

    this.authService.uploadProfileImage(this.imageFile).pipe(
      finalize(() => {
        this.isImageLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.imageFile = null;
        this.updateSuccess = true;

        // Clear success message after some time
        setTimeout(() => {
          this.updateSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        this.updateError = error.error?.detail || 'Failed to upload profile image. Please try again.';
      }
    });
  }

  deleteProfileImage(): void {
    if (!this.user?.profile_image) return;

    this.isImageDeleting = true;
    this.updateError = null;

    this.authService.deleteProfileImage().pipe(
      finalize(() => {
        this.isImageDeleting = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.imageFile = null;
        this.imagePreview = null;
        this.updateSuccess = true;

        // Clear success message after some time
        setTimeout(() => {
          this.updateSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        this.updateError = error.error?.detail || 'Failed to delete profile image. Please try again.';
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid) return;

    this.spinner.show();
    this.updateSuccess = false;
    this.updateError = null;

    const profileData = this.profileForm.getRawValue();

    this.authService.updateUserProfile(profileData).pipe(
      finalize(() => {
        // If we have an image file, upload it separately after profile update
        if (this.imageFile) {
          this.uploadProfileImage();
        } else {
          this.spinner.hide();
          this.updateSuccess = true;
          this.isEditing = false;

          // Clear success message after some time
          setTimeout(() => {
            this.updateSuccess = false;
            this.cdr.detectChanges();
          }, 3000);
        }
      })
    ).subscribe({
      error: (error) => {
        this.spinner.hide();
        this.updateError = error.error?.detail || 'Failed to update profile. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;

    this.spinner.show();
    this.passwordSuccess = false;
    this.passwordError = null;

    const passwordData = {
      old_password: this.passwordForm.value.current_password,
      new_password: this.passwordForm.value.new_password
    };

    this.authService.changePassword(passwordData).pipe(
      finalize(() => {
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.passwordSuccess = true;
        this.passwordForm.reset();

        // Clear success message after some time
        setTimeout(() => {
          this.passwordSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        this.passwordError = error.error?.detail || 'Failed to change password. Please verify your current password and try again.';
      }
    });
  }

  requestPasswordReset(): void {
    if (!this.user?.email) return;

    this.spinner.show();
    this.passwordSuccess = false;
    this.passwordError = null;

    this.authService.requestPasswordReset(this.user.email).pipe(
      finalize(() => {
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.passwordSuccess = true;

        // Clear success message after some time
        setTimeout(() => {
          this.passwordSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: () => {
        this.passwordError = 'Failed to send password reset email. Please try again later.';
      }
    });
  }

  resendVerification(): void {
    if (!this.user?.email) return;

    this.spinner.show();
    this.updateSuccess = false;
    this.updateError = null;

    this.authService.resendVerificationEmail(this.user.email).pipe(
      finalize(() => {
        this.spinner.hide();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.updateSuccess = true;

        // Clear success message after some time
        setTimeout(() => {
          this.updateSuccess = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: () => {
        this.updateError = 'Failed to resend verification email. Please try again later.';
      }
    });
  }
}
