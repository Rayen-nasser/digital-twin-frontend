// Fixed dashboard.component.ts with correct voice message handling
import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { WebsocketService } from '../../services/websocket.service';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Chat } from '../../models/chat.model';
import { Message } from '../../models/message.model';
import { User } from '../../models/user.interface';
import { AuthService } from '../../../auth/service/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  chats$: Observable<Chat[]>;
  messages$: Observable<Message[]>;
  currentChatId$: Observable<string | null>;
  user$: Observable<User | null>;

  isWebSocketConnected = false;
  mobileView = false;
  screenWidth = 0;
  sidebarOpen = false;
  settingsMenuOpen = false;

  private destroy$ = new Subject<void>();

  constructor(
    private chatService: ChatService,
    private wsService: WebsocketService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.chats$ = this.chatService.chats$;
    this.messages$ = this.chatService.messages$;
    this.currentChatId$ = this.chatService.currentChatId$;
    this.user$ = this.authService.user$;
  }

  // Listen for window resize events
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  // Determine if we should show mobile layout
  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.screenWidth = window.innerWidth;
      this.mobileView = this.screenWidth < 1024; // 1024px is the lg breakpoint in Tailwind
    }
  }

  ngOnInit(): void {
    // Initialize screen size check
    this.checkScreenSize();

    // Load all chats when the component initializes
    this.chatService.loadChats().subscribe();

    // Load user profile data
    this.authService.getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe();

    // Monitor WebSocket connection status
    this.wsService.connectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        console.log('Dashboard - WebSocket connection status:', connected);
        this.isWebSocketConnected = connected;
      });
  }

  onChatSelected(chatId: string): void {
    // This method already handles WebSocket connection internally
    this.chatService.selectChat(chatId);

    // Close sidebar on mobile after selecting a chat
    if (this.mobileView) {
      this.sidebarOpen = false;
    }
  }

  createNewChat(): void {
    // Implement new chat creation logic
    console.log('Creating new chat');
    // chatService.createNewChat().subscribe(chatId => {
    //   this.chatService.selectChat(chatId);
    // });
  }

  /**
   * Handle sending messages and attachments
   * @param payload String message or Attachment object
   */
  onSendMessage(payload: any): void {
    this.currentChatId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((currentChatId: string | null) => {
        if (currentChatId) {
          if (typeof payload === 'string') {
            // Text message handling (already implemented)
            this.chatService.sendMessage(currentChatId, payload).subscribe();
          }
          else if (payload.type === 'audio') {
            // FIXED: Use the Blob object directly instead of the URL
            // 1. First, we need to get the actual Blob from the AudioAttachment
            this.fetchAudioBlob(payload.url).then(audioBlob => {
              if (audioBlob) {
                // 2. Now send the actual blob to the server
                this.chatService.saveVoiceMessage(
                  currentChatId,
                  audioBlob,
                  payload.duration || 0,
                  payload.format || 'audio/webm'
                ).subscribe({
                  next: (response) => console.log('Voice message sent successfully', response),
                  error: (error) => console.error('Error sending voice message:', error)
                });
              } else {
                console.error('Could not fetch audio blob from URL:', payload.url);
              }
            });
          }
          else {
            // Other attachment types (for future implementation)
            console.log('Unsupported attachment type:', payload.type);
          }
        }
      });
  }

  /**
   * Fetches the actual Blob object from a blob URL
   * @param blobUrl - The blob URL to fetch from
   * @returns Promise resolving to a Blob or null if fetch fails
   */
  private fetchAudioBlob(blobUrl: string | Blob): Promise<Blob | null> {
    // If it's already a Blob object, return it
    if (blobUrl instanceof Blob) {
      return Promise.resolve(blobUrl);
    }

    // If it's a data URL (starts with data:)
    if (blobUrl.startsWith('data:')) {
      // Extract the base64 data from the data URL
      try {
        const base64 = blobUrl.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const buffer = new ArrayBuffer(len);
        const view = new Uint8Array(buffer);

        for (let i = 0; i < len; i++) {
          view[i] = binary.charCodeAt(i);
        }

        // Determine the content type from the data URL
        const contentType = blobUrl.split(';')[0].split(':')[1] || 'audio/webm';
        return Promise.resolve(new Blob([buffer], { type: contentType }));
      } catch (e) {
        console.error('Error converting data URL to Blob:', e);
        return Promise.resolve(null);
      }
    }

    // If it's a blob URL (starts with blob:)
    if (blobUrl.startsWith('blob:')) {
      return fetch(blobUrl)
        .then(response => response.blob())
        .catch(error => {
          console.error('Error fetching blob from URL:', error);
          return null;
        });
    }

    // If it's neither a blob URL nor a data URL, return null
    console.error('Invalid URL format:', blobUrl);
    return Promise.resolve(null);
  }

  // Go back to chat list in mobile view
  showChatList(): void {
    this.chatService.selectChat('');
  }

  // Toggle sidebar in mobile view
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  // Settings menu methods
  toggleSettingsMenu(): void {
    this.settingsMenuOpen = !this.settingsMenuOpen;
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpen = false;
  }

  ngOnDestroy(): void {
    // Clean up websocket connection
    this.wsService.disconnect();

    // Complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    window.history.back();
  }
}
