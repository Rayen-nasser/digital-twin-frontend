import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { AuthService } from '../../service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';

interface ValidationErrors {
  [key: string]: string[];
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  profilePicture: File | null = null;
  profilePicturePreview: string | null = null;
  isLoading = false;
  isValidFile = true;
  submittedEmail = '';
  step = 1; // Step 1: Form, Step 2: Verification instructions
  showPassword = false;
  isDarkMode = false;

  constructor(
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private authService: AuthService,
    private toastService: ToastrService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    // Check the current theme
    this.isDarkMode = this.themeService.getCurrentTheme() === 'dark';

    // Subscribe to theme changes
    this.themeService.theme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      // File size validation (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.isValidFile = false;
        this.toastService.warning('Profile image must be less than 5MB', 'File Too Large');
        return;
      }

      // File type validation
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        this.isValidFile = false;
        this.toastService.warning('Please upload a JPG, PNG or GIF image', 'Invalid File Type');
        return;
      }

      this.isValidFile = true;
      this.profilePicture = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.profilePicturePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private handleValidationErrors(errors: ValidationErrors): void {
    const errorMessages: string[] = [];

    const processErrors = (field: string, messages: any): void => {
      if (typeof messages === 'string') {
        // Direct string message
        const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
        errorMessages.push(`${formattedField}: ${messages.split(',')[0]}`);
      } else if (Array.isArray(messages)) {
        // Array of error messages
        messages.forEach(message => {
          const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
          errorMessages.push(`${formattedField}: ${message}`);
        });
      } else if (typeof messages === 'object' && messages !== null) {
        // Nested object, process recursively
        Object.entries(messages).forEach(([nestedField, nestedMessages]) => {
          processErrors(nestedField, nestedMessages);
        });
      }
    };

    // Iterate over top-level errors
    Object.entries(errors).forEach(([field, messages]) => {
      processErrors(field, messages);
    });

    // Show each error message as a separate toast
    if (errorMessages.length > 0) {
      errorMessages.forEach(message => {
        this.toastService.error(message, 'Validation Error');
      });
    } else {
      // Generic fallback if no messages are found
      this.toastService.error('An unknown validation error occurred.', 'Validation Error');
    }
  }

  // Shows form field validation errors without waiting for submit
  getFieldError(fieldName: string): string {
    const control = this.registerForm.get(fieldName);
    if (control && control.touched && control.errors) {
      if (control.errors['required']) return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      if (control.errors['minlength']) return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${control.errors['minlength'].requiredLength} characters`;
      if (control.errors['email']) return 'Please enter a valid email address';
    }
    return '';
  }

  onSubmit(): void {
    // Mark all fields as touched to trigger validation messages
    Object.keys(this.registerForm.controls).forEach(key => {
      this.registerForm.get(key)?.markAsTouched();
    });

    if (this.registerForm.valid) {
      const formData = new FormData();

      // Append form fields
      formData.append('username', this.registerForm.get('username')?.value);
      formData.append('email', this.registerForm.get('email')?.value);
      formData.append('password', this.registerForm.get('password')?.value);

      // Save email for potential resend verification
      this.submittedEmail = this.registerForm.get('email')?.value;
      localStorage.setItem('pending_verification_email', this.submittedEmail);

      // Append the file
      if(this.profilePicture){
        formData.append('profile_image', this.profilePicture);
      }

      this.isLoading = true;
      this.spinner.show();
      this.authService.register(formData).subscribe(
        (data: any) => {
          console.log('Response:', data || 'No response body');
          this.spinner.hide();
          this.isLoading = false;
          localStorage.setItem('user_profile', JSON.stringify(data.user));
          // Move to verification instructions screen
          this.step = 2;
        },
        (error: any) => {
          this.spinner.hide();
          this.isLoading = false;

          if (error.error && typeof error.error === 'object') {
            // Handle validation errors
            this.handleValidationErrors(error.error);
          } else if (error.error?.detail) {
            // Handle general error with detail
            this.toastService.error(
              Array.isArray(error.error.detail)
                ? error.error.detail[0]
                : error.error.detail,
              'Registration Failed'
            );
          } else {
            // Handle generic error
            this.toastService.error(
              'Something went wrong. Please try again later.',
              'Registration Failed'
            );
          }
        }
      );
    } else {
      this.toastService.error('Please fill in all required fields correctly.', 'Validation Error');
    }
  }

  // Resend verification email
  resendVerification(): void {
    if (!this.submittedEmail) {
      this.toastService.error('Email address not found', 'Error');
      return;
    }

    this.isLoading = true;
    this.spinner.show();

    this.authService.resendVerificationEmail(this.submittedEmail).subscribe(
      () => {
        this.spinner.hide();
        this.isLoading = false;
        this.toastService.success('Verification email sent again!', 'Success');
      },
      (error) => {
        this.spinner.hide();
        this.isLoading = false;
        this.toastService.error('Failed to resend verification email', 'Error');
      }
    );
  }

  // Continue to login
  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  // Continue browsing while waiting for verification
  continueBrowsing(): void {
    this.router.navigate(['/home']);
  }
}
