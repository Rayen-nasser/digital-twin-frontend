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
    { value: 'shared', label: 'Shared (Shared with selected users)' }
  ];

  // Sentiment configuration
  sentimentCategories = [
    {
      category: 'Emotional Tone',
      options: [
        { value: 'warm', label: 'Warm & Caring', description: 'Expresses empathy and emotional support' },
        { value: 'professional', label: 'Professional', description: 'Maintains formal and respectful tone' },
        { value: 'friendly', label: 'Friendly & Casual', description: 'Approachable and conversational' },
        { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and positive responses' },
        { value: 'calm', label: 'Calm & Measured', description: 'Thoughtful and composed responses' }
      ]
    },
    {
      category: 'Attachment Style',
      options: [
        { value: 'supportive', label: 'Supportive', description: 'Provides encouragement and validation' },
        { value: 'independent', label: 'Independent', description: 'Encourages self-reliance and growth' },
        { value: 'nurturing', label: 'Nurturing', description: 'Protective and caring approach' },
        { value: 'collaborative', label: 'Collaborative', description: 'Works together to solve problems' },
        { value: 'mentoring', label: 'Mentoring', description: 'Guides and teaches through experience' }
      ]
    },
    {
      category: 'Communication Style',
      options: [
        { value: 'direct', label: 'Direct & Clear', description: 'Straightforward communication' },
        { value: 'gentle', label: 'Gentle & Soft', description: 'Kind and considerate approach' },
        { value: 'humorous', label: 'Humorous', description: 'Uses appropriate humor and lightness' },
        { value: 'analytical', label: 'Analytical', description: 'Logical and detail-oriented responses' },
        { value: 'creative', label: 'Creative & Expressive', description: 'Imaginative and artistic communication' }
      ]
    }
  ];

  selectedSentiments: string[] = [];
  customSentiment: string = '';
  showCustomSentimentInput: boolean = false;

  constructor(
    protected fb: FormBuilder,
    protected themeService: ThemeService
  ) {
    this.twinForm = this.createForm();
  }

// Override ngOnInit to set up form value changes subscription
ngOnInit(): void {
  // Subscribe to theme changes
  this.themeSubscription = this.themeService.theme$.subscribe(theme => {
    this.isDarkMode = theme === 'dark';
  });

  // Subscribe to sentiment form changes to update string value
  this.sentimentAttachment.valueChanges.subscribe(() => {
    this.updateSentimentString();
  });
}

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  // Update sentiment string whenever UI changes
updateSentimentString(): void {
  const sentimentString = this.generateSentimentString();
  this.twinForm.get('sentiment')?.setValue(sentimentString);
}


// Add method to convert sentiment data to string
generateSentimentString(): string {
  const selectedSentiments = this.sentimentAttachment.get('selected_sentiments')?.value || [];
  const customSentiment = this.sentimentAttachment.get('custom_sentiment')?.value || '';
  const intensityLevel = this.sentimentAttachment.get('intensity_level')?.value || 'medium';

  let sentimentParts: string[] = [];

  // Add selected sentiments with their labels
  if (selectedSentiments.length > 0) {
    const sentimentLabels = selectedSentiments.map((value: string) => {
      for (const category of this.sentimentCategories) {
        const option = category.options.find(opt => opt.value === value);
        if (option) return option.label;
      }
      return value;
    });
    sentimentParts.push(`Traits: ${sentimentLabels.join(', ')}`);
  }

  // Add intensity level
  if (selectedSentiments.length > 0) {
    sentimentParts.push(`Intensity: ${intensityLevel}`);
  }

  // Add custom sentiment
  if (customSentiment.trim()) {
    sentimentParts.push(`Custom: ${customSentiment.trim()}`);
  }

  return sentimentParts.join(' | ');
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
     sentiment: [''], // Changed to simple string field
      sentiment_attachment: this.fb.group({
        selected_sentiments: [[]],
        custom_sentiment: ['', [Validators.maxLength(300)]],
        intensity_level: ['medium']
      }),
      avatar_image: [null]
    });
  }


  get sentimentAttachment() {
    return this.twinForm.get('sentiment_attachment') as FormGroup;
  }

  toggleSentiment(sentimentValue: string): void {
  const currentSentiments = this.sentimentAttachment.get('selected_sentiments')?.value || [];
  const index = currentSentiments.indexOf(sentimentValue);

  if (index > -1) {
    currentSentiments.splice(index, 1);
  } else {
    currentSentiments.push(sentimentValue);
  }

  this.sentimentAttachment.get('selected_sentiments')?.setValue([...currentSentiments]);
  this.selectedSentiments = [...currentSentiments];
  this.updateSentimentString(); // Update the string value
}

  isSentimentSelected(sentimentValue: string): boolean {
    const currentSentiments = this.sentimentAttachment.get('selected_sentiments')?.value || [];
    return currentSentiments.includes(sentimentValue);
  }

  toggleCustomSentimentInput(): void {
    this.showCustomSentimentInput = !this.showCustomSentimentInput;
    if (!this.showCustomSentimentInput) {
      this.sentimentAttachment.get('custom_sentiment')?.setValue('');
    }
  }

  getSentimentSummary(): string {
    const selected = this.sentimentAttachment.get('selected_sentiments')?.value || [];
    const custom = this.sentimentAttachment.get('custom_sentiment')?.value || '';

    let summary = '';
    if (selected.length > 0) {
      const labels = selected.map((value: string) => {
        for (const category of this.sentimentCategories) {
          const option = category.options.find(opt => opt.value === value);
          if (option) return option.label;
        }
        return value;
      });
      summary = labels.join(', ');
    }

    if (custom) {
      summary += summary ? ` + Custom: ${custom}` : `Custom: ${custom}`;
    }

    return summary || 'No sentiment defined';
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
