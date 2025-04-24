// create-twin.component.ts
import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TwinService } from '../../service/twin.service';
import { ThemeService } from '../../../core/services/theme.service';
import { TwinFormBaseComponent } from '../../../shared/components/twin-form-base/twin-form-base.component';


@Component({
  selector: 'app-create-twin',
  templateUrl: './create-twin.component.html',
  styleUrl: './create-twin.component.scss',
})
export class CreateTwinComponent extends TwinFormBaseComponent {
  isSubmitting: boolean = false;
  constructor(
    protected override fb: FormBuilder,
    protected override themeService: ThemeService,
    private router: Router,
    private twinService: TwinService,
    private toastService: ToastrService
  ) {
    super(fb, themeService);
  }

  onSubmit(): void {
    if (this.twinForm.invalid) {
      this.markFormGroupTouched(this.twinForm);
      return;
    }

    this.isProcessing = true;
    this.isSubmitting = true

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('name', this.twinForm.get('name')?.value);
    formData.append('privacy_setting', this.twinForm.get('privacy_setting')?.value);

    const personaData = {
      persona_description: this.personaData.get('persona_description')?.value,
      conversations: this.conversations.value,
    };
    formData.append('persona_data', JSON.stringify(personaData));

    if (this.twinForm.get('avatar_image')?.value) {
      formData.append('avatar_image', this.twinForm.get('avatar_image')?.value);
    }

    this.twinService.createTwin(formData).subscribe({
      next: (response) => {
        this.isProcessing = false;
        this.isSubmitting = false
        this.handleNotification('success', 'Twin Created', 'Your digital twin has been created successfully');
        this.router.navigate(['/twins', response.id]);
      },
      error: (error) => {
        this.isProcessing = false;
        console.error('Error creating twin:', error);
        this.handleNotification('error', 'Creation Failed', 'There was a problem creating your twin');
      },
    });
  }

  handleNotification(type: string, title: string, message: string): void {
    switch(type) {
      case 'success':
        this.toastService.success(message, title);
        break;
      case 'error':
        this.toastService.error(message, title);
        break;
      case 'warning':
        this.toastService.warning(message, title);
        break;
      default:
        this.toastService.info(message, title);
    }
  }
}
