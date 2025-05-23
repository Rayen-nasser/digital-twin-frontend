// heygen-streaming.component.ts
import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { HeyGenStreamingService, StreamingConfig, StreamingMessage, StreamingStatus } from '../../services/heygen-streaming.service';

@Component({
  selector: 'app-heygen-streaming',
  templateUrl: './heygen-streaming.component.html',
  styleUrls: ['./heygen-streaming.component.scss']
})
export class HeyGenStreamingComponent implements OnInit, OnDestroy {
  @Input() chatId!: string;
  @Input() defaultConfig: Partial<StreamingConfig> = {};

  @ViewChild('messageInput') messageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  messageForm: FormGroup;
  configForm: FormGroup;

  // State
  isSessionActive = false;
  isConnected = false;
  isLoading = false;
  currentStatus: StreamingStatus = { status: 'idle', message: 'Ready' };
  messages: StreamingMessage[] = [];

  // Configuration options
  avatarOptions = [
    { id: 'anna_public_3_20240108', name: 'Anna (Professional)' },
    { id: 'josh_lite3_20230714', name: 'Josh (Casual)' },
    { id: 'susan_public_2_20240328', name: 'Susan (Friendly)' },
    { id: 'eric_public_pro2_20230608', name: 'Eric (Business)' }
  ];

  voiceOptions = [
    { id: '1bd001e7e50f421d891986aad5158bc8', name: 'Female Voice 1' },
    { id: '2d5b0e6c4d7f8a1b3c9e4f5a6b7c8d9e', name: 'Male Voice 1' },
    { id: '3e6c1f8d5a2b7c4e1f8d5a2b7c4e1f8d', name: 'Female Voice 2' },
    { id: '4f7d2a5c8b1e4f7d2a5c8b1e4f7d2a5c', name: 'Male Voice 2' }
  ];

  languageOptions = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private streamingService: HeyGenStreamingService
  ) {
    this.messageForm = this.fb.group({
      message: ['', [Validators.required, Validators.minLength(1)]]
    });

    this.configForm = this.fb.group({
      avatar_id: [this.avatarOptions[0].id, Validators.required],
      voice_id: [this.voiceOptions[0].id, Validators.required],
      language: ['en', Validators.required],
      quality: ['high', Validators.required],
      script: ['', [Validators.required, Validators.minLength(5)]] // Added script field
    });
  }

  ngOnInit(): void {
    // Apply default configuration
    if (this.defaultConfig) {
      this.configForm.patchValue(this.defaultConfig);
    }

    // Set a default script if none provided
    if (!this.configForm.get('script')?.value) {
      this.configForm.patchValue({
        script: 'Hello! I am your AI avatar assistant. How can I help you today?'
      });
    }

    // Subscribe to service observables
    this.streamingService.sessionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: any) => {
        this.currentStatus = status;
        this.isSessionActive = this.streamingService.isSessionActive();
      });

    this.streamingService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
        this.scrollToBottom();
      });

    this.streamingService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
      });

    // Check if there's already an active session
    this.isSessionActive = this.streamingService.isSessionActive();
  }

  trackByMessage(index: number, message: any): any {
    return message.timestamp;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start streaming session
   */
  startStreaming(): void {
    if (!this.configForm.valid) {
      this.markFormGroupTouched(this.configForm);
      return;
    }

    this.isLoading = true;
    const formValue = this.configForm.value;
    const config: StreamingConfig = {
      avatar_id: formValue.avatar_id,
      voice_id: formValue.voice_id,
      language: formValue.language,
      quality: formValue.quality
    };
    const script = formValue.script;

    // Ensure the script is included
    console.log('Starting streaming with config:', config);
    console.log('Initial script:', script);

    this.streamingService.startStreaming(config, script)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Streaming started:', response);
          this.isLoading = false;
          this.focusMessageInput();
        },
        error: (error) => {
          console.error('Error starting streaming:', error);
          this.isLoading = false;
          this.showError('Failed to start streaming session: ' + (error.error?.error || error.message));
        }
      });
  }

  /**
   * Send message to streaming session
   */
  sendMessage(): void {
    if (!this.messageForm.valid || !this.isSessionActive) {
      return;
    }

    const message = this.messageForm.get('message')?.value?.trim();
    if (!message) {
      return;
    }

    this.isLoading = true;

    if (this.chatId) {
      // Use quick chat stream for conversational AI
      const config: StreamingConfig = this.configForm.value;

      this.streamingService.quickChatStream(message, this.chatId, config)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Quick chat response:', response);
            this.isLoading = false;
            this.messageForm.reset();
            this.focusMessageInput();
          },
          error: (error) => {
            console.error('Error in quick chat:', error);
            this.isLoading = false;
            this.showError('Failed to send message: ' + (error.error?.error || error.message));
          }
        });
    } else {
      // Send text to existing session
      this.streamingService.sendText(message)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Text sent:', response);
            this.isLoading = false;
            this.messageForm.reset();
            this.focusMessageInput();
          },
          error: (error) => {
            console.error('Error sending text:', error);
            this.isLoading = false;
            this.showError('Failed to send message: ' + (error.error?.error || error.message));
          }
        });
    }
  }

  /**
   * Generate script from chat and start streaming
   */
  generateAndStream(): void {
    if (!this.chatId || !this.configForm.valid) {
      this.markFormGroupTouched(this.configForm);
      return;
    }

    this.isLoading = true;
    const config: StreamingConfig = this.configForm.value;

    this.streamingService.generateAndStream(this.chatId, config, 'summary')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Generated and streaming:', response);
          this.isLoading = false;
          this.focusMessageInput();
        },
        error: (error) => {
          console.error('Error generating and streaming:', error);
          this.isLoading = false;
          this.showError('Failed to generate and stream content: ' + (error.error?.error || error.message));
        }
      });
  }

  /**
   * Stop streaming session
   */
  stopStreaming(): void {
    if (!this.isSessionActive) {
      return;
    }

    this.isLoading = true;

    this.streamingService.stopStreaming()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Streaming stopped:', response);
          this.isLoading = false;
          this.clearMessages();
        },
        error: (error) => {
          console.error('Error stopping streaming:', error);
          this.isLoading = false;
          this.showError('Failed to stop streaming session: ' + (error.error?.error || error.message));
        }
      });
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.streamingService.clearMessages();
  }

  /**
   * Handle Enter key press in message input
   */
  onMessageKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(): string {
    switch (this.currentStatus.status) {
      case 'ready':
        return 'badge-success';
      case 'talking':
        return 'badge-primary';
      case 'error':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  /**
   * Get message type class
   */
  getMessageClass(message: StreamingMessage): string {
    switch (message.type) {
      case 'user':
        return 'user-message';
      case 'ai':
        return 'ai-message';
      case 'system':
        return 'system-message';
      default:
        return '';
    }
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Mark all fields in form group as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Focus message input
   */
  private focusMessageInput(): void {
    setTimeout(() => {
      if (this.messageInput?.nativeElement) {
        this.messageInput.nativeElement.focus();
      }
    }, 100);
  }

  /**
   * Scroll messages to bottom
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    // You can implement your preferred error notification system here
    console.error(message);
    alert(message); // Simple alert for now
  }
}
