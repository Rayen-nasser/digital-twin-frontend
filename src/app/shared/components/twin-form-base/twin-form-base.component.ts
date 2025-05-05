// twin-form-base.component.ts
import { Directive, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Theme, ThemeService } from '../../../core/services/theme.service';

@Directive({
  selector: '[appTwinFormBase]'
})
export abstract class TwinFormBaseComponent implements OnInit, OnDestroy {
  twinForm: FormGroup;
  imagePreview: string | null = null;
  isProcessing = false;
  jsonUploadError: string | null = null;
  showJsonUploadModal = false;
  activeConversationIndex: number | null = null;
  isDarkMode = false;

  // Configuration constants
  maxConversationExamples = 1000;
  minConversationExamples = 100;
  maxQuestionLength = 1000;
  maxAnswerLength = 2000;
  maxPersonaDescriptionLength = 5000;

  themeSubscription: Subscription | null = null;

  privacyOptions = [
    { value: 'private', label: 'Private (Only you can see and chat)' },
    { value: 'public', label: 'Public (Anyone can see and chat)' },
    { value: 'unlisted', label: 'Unlisted (Only those with the link can see and chat)' }
  ];

  constructor(
    protected fb: FormBuilder,
    protected themeService: ThemeService
  ) {
    this.twinForm = this.createForm();
  }

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.theme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
      // Additional theme-related logic can be added here
    });
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      privacy_setting: ['private', Validators.required],
      is_active: [true],
      persona_data: this.fb.group({
        persona_description: [
          '',
          [Validators.required, Validators.maxLength(this.maxPersonaDescriptionLength)]
        ],
        conversations: this.fb.array([])
      }),
      avatar_image: [null]
    });
  }

  get personaData() {
    return this.twinForm.get('persona_data') as FormGroup;
  }

  get conversations() {
    return this.personaData.get('conversations') as FormArray;
  }

  // Common methods for both components
  addConversation(): void {
    if (this.conversations.length >= this.maxConversationExamples && this.conversations.length <= this.minConversationExamples) {
      this.handleNotification('warning', 'Maximum conversations reached',
        `You can only add up to ${this.maxConversationExamples} conversation examples`);
      return;
    }

    const conversationGroup = this.fb.group({
      question: ['', [Validators.required, Validators.maxLength(this.maxQuestionLength)]],
      answer: ['', [Validators.required, Validators.maxLength(this.maxAnswerLength)]]
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

  removeConversation(index: number, event: Event): void {
    event.stopPropagation();
    this.conversations.removeAt(index);

    // Reset active index if the active one was removed
    if (this.activeConversationIndex === index) {
      this.activeConversationIndex = null;
    } else if (this.activeConversationIndex !== null && this.activeConversationIndex > index) {
      this.activeConversationIndex--;
    }
  }

  toggleConversation(index: number): void {
    this.activeConversationIndex = this.activeConversationIndex === index ? null : index;
  }

  onFileSelected(event: Event): void {
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

  removeImage(): void {
    this.twinForm.patchValue({ avatar_image: null });
    this.imagePreview = null;
  }

  toggleJsonUploadModal(): void {
    this.showJsonUploadModal = !this.showJsonUploadModal;
    this.jsonUploadError = null;
  }

  uploadPersonaJson(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);

        if (this.validatePersonaJson(json)) {
          // Clear existing conversations
          while (this.conversations.length) {
            this.conversations.removeAt(0);
          }

          // Set the persona description
          this.personaData.get('persona_description')?.setValue(json.persona_description);

          // Add conversations
          json.conversations.forEach((conv: { question: string; answer: string }) => {
            this.conversations.push(
              this.fb.group({
                question: [conv.question, [Validators.required, Validators.maxLength(this.maxQuestionLength)]],
                answer: [conv.answer, [Validators.required, Validators.maxLength(this.maxAnswerLength)]]
              })
            );
          });

          this.toggleJsonUploadModal();
          this.handleNotification('success', 'JSON imported', 'Persona data has been imported successfully');
        }
      } catch (error) {
        this.jsonUploadError = 'Invalid JSON format';
      }
    };
    reader.readAsText(file);
  }

  validatePersonaJson(json: any): boolean {
    // Validate JSON structure
    if (!json.persona_description) {
      this.jsonUploadError = 'Missing persona_description field in JSON';
      return false;
    }

    if (!Array.isArray(json.conversations)) {
      this.jsonUploadError = 'Conversations must be an array';
      return false;
    }

    // Validate each conversation
    for (const conv of json.conversations) {
      if (!conv.question || !conv.answer) {
        this.jsonUploadError = 'Each conversation must have question and answer fields';
        return false;
      }

      if (conv.question.length > this.maxQuestionLength) {
        this.jsonUploadError = `Question exceeds maximum length of ${this.maxQuestionLength} characters`;
        return false;
      }

      if (conv.answer.length > this.maxAnswerLength) {
        this.jsonUploadError = `Answer exceeds maximum length of ${this.maxAnswerLength} characters`;
        return false;
      }
    }

    if (json.conversations.length > this.maxConversationExamples) {
      this.jsonUploadError = `Maximum of ${this.maxConversationExamples} conversations allowed`;
      return false;
    }

    return true;
  }

  downloadPersonaJson(twinName?: string): void {
    const personaData = {
      persona_description: this.personaData.get('persona_description')?.value,
      conversations: this.conversations.value
    };

    const blob = new Blob([JSON.stringify(personaData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${twinName || 'persona'}_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.handleNotification('success', 'Export successful', 'Persona data has been exported as JSON');
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(c => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          } else {
            c.markAsTouched();
          }
        });
      }
    });
  }

  // Abstract methods that child components must implement
  abstract handleNotification(type: string, title: string, message: string): void;
}
