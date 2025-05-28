import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { Chat } from '../../models/chat.model';
import { ChatService } from '../../services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss']
})
export class ChatListComponent implements OnInit, OnDestroy {
  @Input() chats: Chat[] | null = [];
  @Input() currentChatId: string | null = null;
  @Output() selectChat = new EventEmitter<string>();

  searchQuery: string = '';
  activeTab: 'recent' | 'unread' | 'archived' = 'recent';
  filteredChats: Chat[] = [];

  private archiveSubscription?: Subscription;
  private messagesReadSubscription?: Subscription;


  constructor(private chatService: ChatService, private cdr: ChangeDetectorRef) {}

ngOnInit(): void {
  console.log(this.chats);
  this.updateFilteredChats();

  // Subscribe to archive notifications
  this.archiveSubscription = this.chatService.chatArchived$.subscribe(
    (archivedChatId) => {
      console.log('Chat archived:', archivedChatId);
      this.updateFilteredChats();
      this.cdr.detectChanges(); // Force change detection
    }
  );

  // Subscribe to messages read notifications
  this.messagesReadSubscription = this.chatService.messagesRead$.subscribe(
    (chatId) => {
      console.log('Messages marked as read for chat:', chatId);
      this.updateFilteredChats();
      this.cdr.detectChanges(); // Force change detection
    }
  );
}

  // 6. Add ngOnDestroy to cleanup subscriptions
  ngOnDestroy(): void {
    if (this.archiveSubscription) {
      this.archiveSubscription.unsubscribe();
    }
    if (this.messagesReadSubscription) {
      this.messagesReadSubscription.unsubscribe();
    }
  }
 ngOnChanges(changes: SimpleChanges): void {
    if (changes['chats'] && this.chats) {
      this.updateFilteredChats();
      this.cdr.detectChanges();
    }
  }

  onSelectChat(chatId: string): void {
    this.selectChat.emit(chatId);
  }

  encodeURI(url: string) {
    return window.encodeURI(url);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value.toLowerCase().trim();
    this.updateFilteredChats();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.updateFilteredChats();
  }

  switchTab(tab: 'recent' | 'unread' | 'archived'): void {
    this.activeTab = tab;
    this.updateFilteredChats();
  }

  updateFilteredChats(): void {
    if (!this.chats) {
      this.filteredChats = [];
      return;
    }

    let filtered = [...this.chats];

    if (this.searchQuery) {
      filtered = filtered.filter(chat =>
        chat.twin_details?.twin_name?.toLowerCase().includes(this.searchQuery) ||
        chat.last_message?.text_content?.toLowerCase().includes(this.searchQuery)
      );
    }

    switch (this.activeTab) {
      case 'recent':
        filtered = filtered.filter(chat => chat.is_archived !== true)
          .sort((a, b) => {
            const dateA = new Date(a.last_active || 0).getTime();
            const dateB = new Date(b.last_active || 0).getTime();
            return dateB - dateA;
          });
        break;

      case 'unread':
        filtered = filtered.filter(chat => chat.unread_count > 0 && chat.is_archived !== true)
          .sort((a, b) => {
            const dateA = new Date(a.last_active || 0).getTime();
            const dateB = new Date(b.last_active || 0).getTime();
            return dateB - dateA;
          });
        break;

      case 'archived':
        filtered = filtered.filter(chat => chat.is_archived === true)
          .sort((a, b) => {
            const dateA = new Date(a.last_active || 0).getTime();
            const dateB = new Date(b.last_active || 0).getTime();
            return dateB - dateA;
          });
        break;
    }

    this.filteredChats = filtered;
  }

  getRecentCount(): number {
    return this.chats?.filter(chat => chat.is_archived !== true).length || 0;
  }

  getUnreadCount(): number {
    return this.chats?.filter(chat => chat.unread_count > 0 && chat.is_archived !== true).length || 0;
  }

  getArchivedCount(): number {
    return this.chats?.filter(chat => chat.is_archived === true).length || 0;
  }

  formatTime(timestamp: string): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    const dayDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  isTodayMessage(timestamp: string): boolean {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }

  truncateMessage(message: string, maxLength: number = 40): string {
    if (!message) return '';
    return message.length > maxLength
      ? `${message.substring(0, maxLength)}...`
      : message;
  }

  highlightSearchTerm(text: string): string {
    if (!this.searchQuery || !text) return text;

    const regex = new RegExp(`(${this.searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  }
}
