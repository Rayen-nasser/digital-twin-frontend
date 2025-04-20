import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { AuthService } from '../../service/auth.service';
import { ToastrService } from 'ngx-toastr';

interface ValidationErrors {
  [key: string]: string[];
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  profilePicture: File | null = null;
  profilePicturePreview: string | null = null;
  isLoading = false;
  isValidFile = true;

  constructor(
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private authService: AuthService,
    private toastService: ToastrService
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
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


  onSubmit(): void {
    if (this.registerForm.valid) {
      const formData = new FormData();

      // Append form fields
      formData.append('username', this.registerForm.get('username')?.value);
      formData.append('email', this.registerForm.get('email')?.value);
      formData.append('password', this.registerForm.get('password')?.value);

      // Append the file
      if(this.profilePicture){
        formData.append('profile_image', this.profilePicture);
      }

      this.spinner.show();
      this.authService.register(formData).then(
        (data: any) => {
          console.log('Response:', data || 'No response body');
          this.spinner.hide();
          this.registerForm.reset();
          this.profilePicture = null;
          this.profilePicturePreview = null;
          this.isValidFile = true;
          this.toastService.success('Registration successful. Please log in.');
        }
      ).catch(
        (error: any) => {
          this.spinner.hide();

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
      this.toastService.error('Please fill in all required fields.', 'Validation Error');
      return;
    }
  }
}
