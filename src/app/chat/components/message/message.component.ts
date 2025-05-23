import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { Message } from '../../models/message.model';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComponent implements OnInit {
  playVoiceMessage() {
    throw new Error('Method not implemented.');
  }
  @Input() message!: Message;
  @Input() isFirstInSequence: boolean = false;
  @Input() twinName: string = '';
  @Input() twinAvatarUrl: string | null = null;
  @Input() isDarkMode: boolean = false;
  @Output() messageAction = new EventEmitter<{
    action: string;
    messageId: string;
  }>();

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {}

  // Close menu when clicking outside
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (
      !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.cdr.detectChanges();
    }
  }

  formatTime(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatMessageContent(text_content: string): string {
    if (!text_content) return '';

    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text_content = text_content.replace(
      urlRegex,
      '<a href="$1" target="_blank" class="text-blue-600 dark:text-blue-400 underline">$1</a>'
    );

    // Convert line breaks to <br> tags
    text_content = text_content.replace(/\n/g, '<br>');

    return text_content;
  }

  replyToMessage(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    console.log('Replying to message:', this.message.id);
    this.messageAction.emit({
      action: 'reply',
      messageId: this.message.id || '',
    });

    this.chatService.setReplyToMessage(this.message);

    this.cdr.detectChanges(); // Force change detection
  }

  deleteMessage(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    if (confirm('Are you sure you want to delete this message?')) {
      console.log('Deleting message:', this.message.id);
      this.messageAction.emit({
        action: 'delete',
        messageId: this.message.id || '',
      });
    }

    this.cdr.detectChanges(); // Force change detection
  }

  reportMessage(event?: MouseEvent): void {
    this.messageAction.emit({
      action: 'report',
      messageId: this.message.id || '',
    });

    this.cdr.detectChanges(); // Force change detection
  }
}
