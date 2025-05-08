import {
  Component,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Input,
  OnDestroy,
  HostListener,
  OnInit
} from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { Observable } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';

interface Attachment {
  type: 'image' | 'audio' | 'file';
  name: string;
  url: string;
  size?: number;
}

@Component({
  selector: 'app-chat-input',
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.scss']
})
export class ChatInputComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() sendMessage = new EventEmitter<string | Attachment>();
  @Output() typingStatus = new EventEmitter<boolean>();
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Input() isConnected: boolean = false;

  message: string = '';
  showEmojiPicker: boolean = false;
  typingTimeout: ReturnType<typeof setTimeout> | null = null;
  theme$: Observable<'light' | 'dark'>;

  // Mobile responsiveness
  showCompactUI: boolean = false;
  showActionMenu: boolean = false;
  screenWidth: number = 0;

  // Recording state
  isRecording: boolean = false;
  recordingTime: number = 0;
  recordingInterval: ReturnType<typeof setInterval> | null = null;

  // Media recorder
  private mediaRecorder!: MediaRecorder;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

  // Attachments
  attachments: Attachment[] = [];

  // Emoji categories with type definition
  emojiCategories: {[key: string]: string[]} = {
    'Smileys': ['😊', '😂', '🥹', '😍', '🥰', '😎', '🤩', '😇'],
    'Gestures': ['👍', '👏', '👋', '🙌', '🤝', '👆', '✌️', '🫶'],
    'Symbols': ['❤️', '🔥', '⭐', '🎉', '✨', '💯', '🙏', '💪']
  };
  activeEmojiCategory: string = 'Smileys';

  constructor(
    private wsService: WebsocketService,
    private themeService: ThemeService
  ) {
    this.theme$ = this.themeService.theme$;
  }

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize.bind(this));
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
        this.adjustTextareaHeight();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopRecording();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
    }
    // Clean up media resources
    this.closeMediaStream();
    // Remove resize listener
    window.removeEventListener('resize', this.checkScreenSize.bind(this));
  }

  // Check screen size for responsive UI
  checkScreenSize(): void {
    this.screenWidth = window.innerWidth;
    this.showCompactUI = this.screenWidth < 640; // sm breakpoint in Tailwind
  }

  // Toggle action menu for mobile
  toggleActionMenu(): void {
    this.showActionMenu = !this.showActionMenu;
    // Always close emoji picker when action menu is toggled
    this.showEmojiPicker = false;
  }

  // Handle clicks outside emoji picker to close it
  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showEmojiPicker && !target.closest('.emoji-container') && !target.closest('.emoji-button')) {
      this.showEmojiPicker = false;
    }

    // Close action menu when clicking outside
    if (this.showActionMenu && !target.closest('.action-menu') && !target.closest('[aria-label="Show actions"]')) {
      this.showActionMenu = false;
    }
  }

  // Adjust textarea height based on content
  adjustTextareaHeight(): void {
    const textarea = this.messageInput.nativeElement;
    textarea.style.height = 'auto';
    // Different max height for mobile
    const maxHeight = this.showCompactUI ? 80 : 120;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  }

  onSendMessage(): void {
    const trimmedMessage = this.message.trim();
    if (trimmedMessage || this.attachments.length > 0) {
      // Send text message
      if (trimmedMessage) {
        this.sendMessage.emit(trimmedMessage);
      }

      // Send attachments
      for (const attachment of this.attachments) {
        this.sendMessage.emit(attachment);
      }

      // Clear state
      this.message = '';
      this.attachments = [];
      this.wsService.sendTypingIndicator(false);
      this.typingStatus.emit(false);

      // Reset textarea height
      if (this.messageInput) {
        this.messageInput.nativeElement.style.height = 'auto';
      }

      setTimeout(() => {
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    } else {
      this.wsService.sendTypingIndicator(true);
      this.typingStatus.emit(true);

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      this.typingTimeout = setTimeout(() => {
        this.wsService.sendTypingIndicator(false);
        this.typingStatus.emit(false);
      }, 1500);
    }
  }

  onMessageChange(): void {
    this.adjustTextareaHeight();
  }

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
    // Close action menu when emoji picker is opened
    if (this.showEmojiPicker) {
      this.showActionMenu = false;
    }
  }

  setEmojiCategory(category: string): void {
    this.activeEmojiCategory = category;
  }

  addEmoji(emoji: string): void {
    this.message += emoji;
    this.showEmojiPicker = false;
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
        this.adjustTextareaHeight();
      }
    });
  }

  // Start audio recording
  startRecording(): void {
    this.isRecording = true;
    this.recordingTime = 0;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.mediaStream = stream;
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        this.attachments.push({
          type: 'audio',
          name: `Voice Message (${this.formatRecordingTime(this.recordingTime)})`,
          url: audioUrl
        });

        // Clean up media stream
        this.closeMediaStream();
      };

      this.mediaRecorder.start();

      // Start recording timer
      this.recordingInterval = setInterval(() => {
        this.recordingTime++;
      }, 1000);
    }).catch(err => {
      console.error('Error accessing microphone:', err);
      this.isRecording = false;
    });
  }

  // Stop audio recording
  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      this.mediaRecorder.stop();

      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
    }
  }

  // Format recording time as MM:SS
  formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Handle file attachment
  onAttachmentClick(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);

      files.forEach(file => {
        const fileType = file.type.startsWith('image/') ? 'image' : 'file';
        const reader = new FileReader();

        reader.onload = () => {
          this.attachments.push({
            type: fileType,
            name: file.name,
            size: file.size,
            url: reader.result as string
          });
        };

        reader.readAsDataURL(file);
      });

      // Reset input so the same file can be selected again
      input.value = '';
    }
  }

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
  }

  // Clean up media stream resources
  private closeMediaStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
}
