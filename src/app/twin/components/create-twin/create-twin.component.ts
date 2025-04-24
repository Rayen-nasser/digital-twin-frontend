import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TwinService } from '../../service/twin.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-create-twin',
  templateUrl: './create-twin.component.html',
  styleUrl: './create-twin.component.scss',
})
export class CreateTwinComponent implements OnInit, OnDestroy {
  twinForm: FormGroup;
  isSubmitting = false;
  imagePreview: string | null = null;
  maxConversationExamples = 110;
  maxQuestionLength = 1000;
  maxAnswerLength = 2000;
  maxPersonaDescriptionLength = 5000;

  // UI state management
  activeConversationIndex: number | null = null;
  jsonUploadError: string | null = null;
  showJsonUploadModal = false;
  darkMode = false;

  // Subscription
  private themeSubscription: Subscription | null = null;

  privacyOptions = [
    { value: 'private', label: 'Private (Only you can see and chat)' },
    { value: 'public', label: 'Public (Anyone can see and chat)' },
    {
      value: 'unlisted',
      label: 'Unlisted (Only those with the link can see and chat)',
    },
  ];

  constructor(
    private fb: FormBuilder,
    private twinService: TwinService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.twinForm = this.createForm();
  }

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.darkMode$.subscribe((isDark) => {
      this.darkMode = isDark;
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      privacy_setting: ['private', Validators.required],
      persona_data: this.fb.group({
        persona_description: [
          '',
          [
            Validators.required,
            Validators.maxLength(this.maxPersonaDescriptionLength),
          ],
        ],
        conversations: this.fb.array([]),
      }),
      avatar_image: [null],
    });
  }

  get personaData() {
    return this.twinForm.get('persona_data') as FormGroup;
  }

  get conversations() {
    return this.personaData.get('conversations') as FormArray;
  }

  addConversation() {
    if (this.conversations.length >= this.maxConversationExamples) {
      return;
    }

    const conversationGroup = this.fb.group({
      question: [
        '',
        [Validators.required, Validators.maxLength(this.maxQuestionLength)],
      ],
      answer: [
        '',
        [Validators.required, Validators.maxLength(this.maxAnswerLength)],
      ],
    });

    this.conversations.push(conversationGroup);

    // Automatically set the new conversation as active and ensure it's visible
    setTimeout(() => {
      this.activeConversationIndex = this.conversations.length - 1;
      this.scrollToConversation(this.conversations.length - 1);
    }, 100);
  }

  scrollToConversation(index: number): void {
    const element = document.getElementById(`conversation-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  removeConversation(index: number, event: Event) {
    event.stopPropagation();
    this.conversations.removeAt(index);

    // Reset active index if the active one was removed
    if (this.activeConversationIndex === index) {
      this.activeConversationIndex = null;
    } else if (
      this.activeConversationIndex !== null &&
      this.activeConversationIndex > index
    ) {
      // Adjust the index if a conversation before the active one was removed
      this.activeConversationIndex--;
    }
  }

  toggleConversation(index: number) {
    this.activeConversationIndex =
      this.activeConversationIndex === index ? null : index;
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (file) {
      this.twinForm.patchValue({ avatar_image: file });

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.twinForm.patchValue({ avatar_image: null });
    this.imagePreview = null;
  }

  toggleJsonUploadModal() {
    this.showJsonUploadModal = !this.showJsonUploadModal;
    this.jsonUploadError = null;
  }

  uploadPersonaJson(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);

        // Validate JSON structure
        if (!json.persona_description) {
          this.jsonUploadError = 'Missing persona_description field in JSON';
          return;
        }

        if (!Array.isArray(json.conversations)) {
          this.jsonUploadError = 'Conversations must be an array';
          return;
        }

        // Validate each conversation
        for (const conv of json.conversations) {
          if (!conv.question || !conv.answer) {
            this.jsonUploadError =
              'Each conversation must have question and answer fields';
            return;
          }

          if (conv.question.length > this.maxQuestionLength) {
            this.jsonUploadError = `Question exceeds maximum length of ${this.maxQuestionLength} characters`;
            return;
          }

          if (conv.answer.length > this.maxAnswerLength) {
            this.jsonUploadError = `Answer exceeds maximum length of ${this.maxAnswerLength} characters`;
            return;
          }
        }

        if (json.conversations.length > this.maxConversationExamples) {
          this.jsonUploadError = `Maximum of ${this.maxConversationExamples} conversations allowed`;
          return;
        }

        // Clear existing conversations
        while (this.conversations.length) {
          this.conversations.removeAt(0);
        }

        // Set the persona description
        this.personaData
          .get('persona_description')
          ?.setValue(json.persona_description);

        // Add conversations
        json.conversations.forEach(
          (conv: { question: string; answer: string }) => {
            this.conversations.push(
              this.fb.group({
                question: [
                  conv.question,
                  [
                    Validators.required,
                    Validators.maxLength(this.maxQuestionLength),
                  ],
                ],
                answer: [
                  conv.answer,
                  [
                    Validators.required,
                    Validators.maxLength(this.maxAnswerLength),
                  ],
                ],
              })
            );
          }
        );

        this.toggleJsonUploadModal();
      } catch (error) {
        this.jsonUploadError = 'Invalid JSON format';
      }
    };
    reader.readAsText(file);
  }

  downloadPersonaJson() {
    const personaData = {
      persona_description: this.personaData.get('persona_description')?.value,
      conversations: this.conversations.value,
    };

    const blob = new Blob([JSON.stringify(personaData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `persona_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onSubmit() {
    if (this.twinForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      this.markFormGroupTouched(this.twinForm);
      return;
    }

    this.isSubmitting = true;

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('name', this.twinForm.get('name')?.value);
    formData.append(
      'privacy_setting',
      this.twinForm.get('privacy_setting')?.value
    );

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
        this.isSubmitting = false;
        // Navigate to the twin detail page or list
        this.router.navigate(['/twins', response.id]);
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error creating twin:', error);
        // Handle error - you might want to display an error message
      },
    });
  }

  // Helper method to mark all controls in a form group as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((c) => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          } else {
            c.markAsTouched();
          }
        });
      }
    });
  }
}
