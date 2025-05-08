import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit
} from '@angular/core';
import { Message } from '../../models/message.model';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageComponent implements OnInit {
  @Input() message!: Message;
  @Input() isFirstInSequence: boolean = false;
  @Input() twinName: string = '';
  @Input() twinAvatarUrl: string | null = null;
  @Input() isDarkMode: boolean = false;

  @Output() messageAction = new EventEmitter<{action: string, messageId: string, emoji?: string}>();

  isActionsMenuOpen: boolean = false;
  reactionOptions: string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  showReactions: boolean = false;

  constructor() {}

  ngOnInit(): void {}

  formatTime(dateString: string): string {
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

  toggleActionsMenu(): void {
    this.isActionsMenuOpen = !this.isActionsMenuOpen;
    // Close reactions panel when opening actions menu
    if (this.isActionsMenuOpen) {
      this.showReactions = false;
    }
  }

  toggleReactions(): void {
    this.showReactions = !this.showReactions;
    // Close actions menu when opening reactions
    if (this.showReactions) {
      this.isActionsMenuOpen = false;
    }
  }

  addReaction(emoji: string): void {
    this.messageAction.emit({
      action: 'react',
      messageId: this.message.id || '',
      emoji: emoji
    });
    this.showReactions = false;
  }

  replyToMessage(): void {
    this.messageAction.emit({
      action: 'reply',
      messageId: this.message.id || ''
    });
    this.isActionsMenuOpen = false;
  }

  copyMessage(): void {
    if (this.message.text_content) {
      navigator.clipboard.writeText(this.message.text_content)
        .then(() => {
          // Show a toast or notification that message was copied
          this.messageAction.emit({
            action: 'copy-success',
            messageId: this.message.id || ''
          });
        })
        .catch(err => {
          console.error('Could not copy message: ', err);
        });
    }
    this.isActionsMenuOpen = false;
  }

  deleteMessage(): void {
    if (confirm('Are you sure you want to delete this message?')) {
      this.messageAction.emit({
        action: 'delete',
        messageId: this.message.id || ''
      });
    }
    this.isActionsMenuOpen = false;
  }

  forwardMessage(): void {
    this.messageAction.emit({
      action: 'forward',
      messageId: this.message.id || ''
    });
    this.isActionsMenuOpen = false;
  }

  translateMessage(): void {
    this.messageAction.emit({
      action: 'translate',
      messageId: this.message.id || ''
    });
    this.isActionsMenuOpen = false;
  }
}
