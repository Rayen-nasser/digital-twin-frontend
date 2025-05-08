
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Chat } from '../../models/chat.model';

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss']
})
export class ChatListComponent implements OnInit {
  @Input() chats: Chat[] | null = [];
  @Input() currentChatId: string | null = null;
  @Output() selectChat = new EventEmitter<string>();

  ngOnInit(): void {
    console.log(this.chats);

  }

  onSelectChat(chatId: string): void {
    this.selectChat.emit(chatId);
  }

  encodeURI(url: string) {
    return window.encodeURI(url);
  }

  // Format the time to display as "Today", "Yesterday", or the date
  formatTime(timestamp: string): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Check if it's within the current week
    const dayDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    // Otherwise return the date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Check if message is from today
  isTodayMessage(timestamp: string): boolean {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }

  // Truncate a message if it's too long
  truncateMessage(message: string, maxLength: number = 40): string {
    if (!message) return '';
    return message.length > maxLength
      ? `${message.substring(0, maxLength)}...`
      : message;
  }
}
