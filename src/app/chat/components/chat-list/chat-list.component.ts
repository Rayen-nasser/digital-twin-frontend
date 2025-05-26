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

  // Search and filter properties
  searchQuery: string = '';
  activeTab: 'recent' | 'unread' | 'archived' = 'recent';
  filteredChats: Chat[] = [];

  ngOnInit(): void {
    console.log(this.chats);
    this.updateFilteredChats();
  }

  ngOnChanges(): void {
    this.updateFilteredChats();
  }

  onSelectChat(chatId: string): void {
    this.selectChat.emit(chatId);
  }

  encodeURI(url: string) {
    return window.encodeURI(url);
  }

  // Search functionality
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value.toLowerCase().trim();
    this.updateFilteredChats();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.updateFilteredChats();
  }

  // Tab switching functionality
  switchTab(tab: 'recent' | 'unread' | 'archived'): void {
    this.activeTab = tab;
    this.updateFilteredChats();
  }

  // Update filtered chats based on search and active tab
  updateFilteredChats(): void {
    if (!this.chats) {
      this.filteredChats = [];
      return;
    }

    let filtered = [...this.chats];

    // Apply search filter
    if (this.searchQuery) {
      filtered = filtered.filter(chat =>
        chat.twin_details?.twin_name?.toLowerCase().includes(this.searchQuery) ||
        chat.last_message?.text_content?.toLowerCase().includes(this.searchQuery)
      );
    }

    // Apply tab filter
    switch (this.activeTab) {
      case 'recent':
        // Show all chats, sorted by last activity (most recent first)
        filtered = filtered.sort((a, b) => {
          const dateA = new Date(a.last_active || 0).getTime();
          const dateB = new Date(b.last_active || 0).getTime();
          return dateB - dateA;
        });
        break;

      case 'unread':
        // Show only chats with unread messages
        filtered = filtered.filter(chat => chat.unread_count > 0)
          .sort((a, b) => {
            const dateA = new Date(a.last_active || 0).getTime();
            const dateB = new Date(b.last_active || 0).getTime();
            return dateB - dateA;
          });
        break;

      case 'archived':
        // Show only archived chats
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

  // Get count for each tab
  getRecentCount(): number {
    return this.chats?.length || 0;
  }

  getUnreadCount(): number {
    return this.chats?.filter(chat => chat.unread_count > 0).length || 0;
  }

  getArchivedCount(): number {
    return this.chats?.filter(chat => chat.is_archived === true).length || 0;
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

  // Highlight search terms in text
  highlightSearchTerm(text: string): string {
    if (!this.searchQuery || !text) return text;

    const regex = new RegExp(`(${this.searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  }
}
