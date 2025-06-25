// detail-twin.component.ts - Add sentiment functionality
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TwinService, Twin } from '../../service/twin.service';
import { ThemeService } from '../../../core/services/theme.service';
import { TwinFormBaseComponent } from '../../../shared/components/twin-form-base/twin-form-base.component';
import { AuthService } from '../../../auth/service/auth.service';
import { ChatService } from '../../../chat/services/chat.service';

@Component({
  selector: 'app-detail-twin',
  templateUrl: './detail-twin.component.html',
  styleUrls: ['./detail-twin.component.scss']
})
export class DetailTwinComponent extends TwinFormBaseComponent implements OnInit {
  twinId: string = '';
  twin: Twin | null = null;
  isLoading = true;
  isEditMode = false;
  error: string | null = null;
  originalImageUrl: string | null = null;
  showDeleteModal = false;
  isSaving: boolean = false;
  isAuthenticated = false

  // Share modal properties
  showShareModal = false;
  shareForm: FormGroup;
  isSharing = false;

  // Destroy notifier
  private destroy$ = new Subject<void>();

  constructor(
    protected override fb: FormBuilder,
    protected override themeService: ThemeService,
    private twinService: TwinService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private chatService: ChatService,
    private toastService: ToastrService
  ) {
    super(fb, themeService);

    // Initialize share form
    this.shareForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      expirationDays: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();

    this.isAuthenticated = this.authService.isLoggedIn();

    // Get twin ID from route params
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.twinId = params['id'];
        this.loadTwinDetails();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTwinDetails(): void {
    this.isLoading = true;
    this.error = null;

    this.twinService.getTwin(this.twinId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (twin: Twin) => {
          this.twin = twin;
          this.populateForm(twin);
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.error = 'Failed to load twin details';
          console.error('Error loading twin:', err);
        }
      });
  }

  populateForm(twin: Twin): void {
    this.originalImageUrl = twin.avatar_url;
    this.imagePreview = twin.avatar_url;

    // Reset conversations array
    while (this.conversations.length) {
      this.conversations.removeAt(0);
    }

    // Set form values
    this.twinForm.patchValue({
      name: twin.name,
      privacy_setting: twin.privacy_setting,
      is_active: twin.is_active
    });

    // Set sentiment data if available
    if (twin.sentiment) {
      // Parse sentiment string back to form structure for editing
      this.parseSentimentString(twin.sentiment);
    }

    // Set persona data
    if (twin.persona_data) {
      this.personaData.get('persona_description')?.setValue(twin.persona_data.persona_description);

      // Add conversations
      if (twin.persona_data.conversations && Array.isArray(twin.persona_data.conversations)) {
        twin.persona_data.conversations.forEach(conv => {
          this.conversations.push(
            this.fb.group({
              question: [conv.question, [Validators.required, Validators.maxLength(this.maxQuestionLength)]],
              answer: [conv.answer, [Validators.required, Validators.maxLength(this.maxAnswerLength)]]
            })
          );
        });
      }
    }
  }

  // Parse sentiment string back to form structure for editing
  parseSentimentString(sentimentString: string): void {
    if (!sentimentString) return;

    const parts = sentimentString.split(' | ');
    const selectedSentiments: string[] = [];
    let customSentiment = '';
    let intensityLevel = 'medium';

    parts.forEach(part => {
      if (part.startsWith('Traits: ')) {
        const traitsText = part.replace('Traits: ', '');
        const traitLabels = traitsText.split(', ');

        // Convert labels back to values
        traitLabels.forEach(label => {
          for (const category of this.sentimentCategories) {
            const option = category.options.find(opt => opt.label === label);
            if (option) {
              selectedSentiments.push(option.value);
            }
          }
        });
      } else if (part.startsWith('Intensity: ')) {
        intensityLevel = part.replace('Intensity: ', '').toLowerCase();
      } else if (part.startsWith('Custom: ')) {
        customSentiment = part.replace('Custom: ', '');
        this.showCustomSentimentInput = true;
      }
    });

    // Set sentiment form values
    this.sentimentAttachment.patchValue({
      selected_sentiments: selectedSentiments,
      custom_sentiment: customSentiment,
      intensity_level: intensityLevel
    });

    this.selectedSentiments = selectedSentiments;
  }

  saveChanges(): void {
    if (this.twinForm.invalid) {
      this.markFormGroupTouched(this.twinForm);
      return;
    }

    this.isProcessing = true;
    this.isSaving = true;

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('name', this.twinForm.get('name')?.value);
    formData.append('privacy_setting', this.twinForm.get('privacy_setting')?.value);
    formData.append('is_active', this.twinForm.get('is_active')?.value);

    // Add sentiment as string
    const sentimentString = this.twinForm.get('sentiment')?.value || '';
    formData.append('sentiment', sentimentString);

    const personaData = {
      persona_description: this.personaData.get('persona_description')?.value,
      conversations: this.conversations.value
    };
    formData.append('persona_data', JSON.stringify(personaData));

    // Only append avatar image if it was changed
    if (this.twinForm.get('avatar_image')?.value) {
      formData.append('avatar_image', this.twinForm.get('avatar_image')?.value);
    }

    this.twinService.updateTwin(this.twinId, formData).subscribe({
      next: (response: Twin) => {
        this.isProcessing = false;
        this.isEditMode = false;
        this.twin = response;
        this.populateForm(response);
        this.isSaving = false;
        this.handleNotification('success', 'Changes saved', 'Twin has been updated successfully');
      },
      error: (err) => {
        this.isProcessing = false;
        this.isSaving = false;
        console.error('Error updating twin:', err);
        this.handleNotification('error', 'Error saving changes', 'Failed to update twin');
      }
    });
  }

  // ... rest of existing methods remain the same ...

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;

    // If canceling edit, reset form to original values
    if (!this.isEditMode && this.twin) {
      this.populateForm(this.twin);
      this.handleNotification('info', 'Edit canceled', 'Changes have been discarded');
    }
  }

  toggleActiveStatus(): void {
    if (!this.twin) return;

    this.twinService.toggleTwinActive(this.twinId).subscribe({
      next: (response: Twin) => {
        if (this.twin) {
          this.twin.is_active = response.is_active;
          this.twinForm.get('is_active')?.setValue(response.is_active);
        }

        this.handleNotification('success', 'Status updated',
          `Twin is now ${response.is_active ? 'active' : 'inactive'}`);
      },
      error: (err) => {
        console.error('Error toggling twin active status:', err);
        this.handleNotification('error', 'Error updating status', 'Failed to update twin status');
      }
    });
  }

  // Share functionality
  shareTwin(): void {
    this.showShareModal = true;
  }

  submitShareForm(): void {
    if (this.shareForm.invalid) {
      this.markFormGroupTouched(this.shareForm);
      return;
    }

    this.isSharing = true;

    const shareData = {
      user_email: this.shareForm.get('email')?.value,
      expires_in_days: this.shareForm.get('expirationDays')?.value,
    };

    this.twinService.shareTwin(this.twinId, shareData).subscribe({
      next: (response: any) => {
        this.isSharing = false;
        this.closeShareModal();
        this.handleNotification('success', 'Twin Shared',
          `Successfully shared ${this.twin?.name} with ${shareData.user_email}`);
      },
      error: (err: any) => {
        this.isSharing = false;
        console.error('Error sharing twin:', err);
        this.handleNotification('error', 'Error Sharing Twin',
          'Failed to share twin. Please try again.');
      }
    });
  }

  closeShareModal(): void {
    this.showShareModal = false;
    this.shareForm.reset({
      expirationDays: 7
    });
  }

  // Delete functionality
  openDeleteConfirmation(): void {
    this.showDeleteModal = true;
  }

  closeDeleteConfirmation(): void {
    this.showDeleteModal = false;
  }

  deleteTwin(): void {
    if (!this.twin) return;

    this.twinService.deleteTwin(this.twinId).subscribe({
      next: () => {
        this.handleNotification('success', 'Twin deleted', `${this.twin?.name} has been deleted`);
        this.router.navigate(['/twin']);
      },
      error: (err) => {
        console.error('Error deleting twin:', err);
        this.handleNotification('error', 'Error deleting twin', 'Failed to delete twin');
      }
    });
  }

  duplicateTwin(): void {
    if (!this.twin) return;

    this.twinService.duplicateTwin(this.twinId).subscribe({
      next: (response: Twin) => {
        this.handleNotification('success', 'Twin duplicated',
          `Successfully created a copy of ${this.twin?.name}`);
        this.router.navigate(['/twin', response.id]);
      },
      error: (err) => {
        console.error('Error duplicating twin:', err);
        this.handleNotification('error', 'Error duplicating twin', 'Failed to create a copy');
      }
    });
  }

  chatWithTwin(twin: Twin, $event: MouseEvent) {
    $event.stopPropagation();

    // Check if user is authenticated
    if (!this.isAuthenticated) {
      this.toastService.info(
        'Authentication required',
        'Please log in to chat with twins'
      );
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.chatService.getChatByTwin(twin.id).subscribe({
      next: (existingChat: any) => {
        if (existingChat) {
          this.router.navigate(['/chat/dashboard']);
        } else {
          const payload = {
            twin: twin.id,
          };

          this.chatService.CreateChat(payload).subscribe({
            next: (response: any) => {
              console.log('Chat created:', response);
              this.router.navigate(['/chat/dashboard']);
            },
            error: (error: any) => {
              console.error('Error creating chat:', error);
              this.toastService.error('Failed to create chat');
            },
          });
        }
      },
      error: (error: any) => {
        console.error('Error checking existing chat:', error);
        this.toastService.error('Failed to check existing chat');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/twin']);
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
