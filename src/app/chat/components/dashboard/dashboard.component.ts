// dashboard.component.ts
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
    private themeService: ThemeService,
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
    // For text messages
    if (typeof payload === 'string') {
      if (!payload.trim()) return;

      this.currentChatId$
        .pipe(takeUntil(this.destroy$))
        .subscribe((currentChatId: string | null) => {
          if (currentChatId) {
            // Let the ChatService handle both HTTP and WebSocket sending
            this.chatService.sendMessage(currentChatId, payload).subscribe();
          }
        });
    }
    // For attachment objects
    else {
      this.currentChatId$
        .pipe(takeUntil(this.destroy$))
        .subscribe((currentChatId: string | null) => {
          if (currentChatId) {
            // Handle attachment
            //this.chatService.sendAttachment(currentChatId, payload).subscribe();
          }
        });
    }
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
