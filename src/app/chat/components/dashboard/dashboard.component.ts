// Enhanced dashboard.component.ts with HeyGen streaming integration
import { Component, OnInit, OnDestroy, HostListener, PLATFORM_ID, Inject, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { WebsocketService } from '../../services/websocket.service';
import { HeyGenStreamingService } from '../../services/heygen-streaming.service';
import { Observable, Subject, takeUntil, combineLatest } from 'rxjs';
import { Chat } from '../../models/chat.model';
import { Message } from '../../models/message.model';
import { User } from '../../models/user.interface';
import { AuthService } from '../../../auth/service/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('heygenStreaming') heygenStreamingComponent: any;

  chats$: Observable<Chat[]>;
  messages$: Observable<Message[]>;
  currentChatId$: Observable<string | null>;
  user$: Observable<User | null>;

  isWebSocketConnected = false;
  mobileView = false;
  screenWidth = 0;
  sidebarOpen = false;
  settingsMenuOpen = false;

  // Report modal properties
  showReportModal = false;
  reportingMessageId = '';

  // HeyGen streaming properties
  showStreamingPanel = false;
  isStreamingActive = false;
  streamingConfig = {
    avatar_id: 'anna_public_3_20240108',
    voice_id: '1bd001e7e50f421d891986aad5158bc8',
    language: 'en',
    quality: 'high'
  };

  private destroy$ = new Subject<void>();

  constructor(
    private chatService: ChatService,
    private wsService: WebsocketService,
    private authService: AuthService,
    private heygenService: HeyGenStreamingService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private toasterService: ToastrService
  ) {
    this.chats$ = this.chatService.chats$;
    this.messages$ = this.chatService.messages$;
    this.currentChatId$ = this.chatService.currentChatId$;
    this.user$ = this.authService.user$;
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.screenWidth = window.innerWidth;
      this.mobileView = this.screenWidth < 1024;
    }
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.chatService.loadChats().subscribe();
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

    // Monitor HeyGen streaming status
    this.heygenService.sessionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isStreamingActive = this.heygenService.isSessionActive();
        console.log('HeyGen streaming status:', status);
      });

    // Auto-start streaming when chat is selected (optional)
    this.currentChatId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(chatId => {
        if (chatId && this.showStreamingPanel) {
          this.prepareStreamingForChat(chatId);
        }
      });
  }

  // Enhanced chat selection with streaming preparation
  onChatSelected(chatId: string): void {
    this.chatService.selectChat(chatId);

    // Close sidebar on mobile after selecting a chat
    if (this.mobileView) {
      this.sidebarOpen = false;
    }

    // Prepare streaming for the selected chat if streaming panel is open
    if (this.showStreamingPanel) {
      this.prepareStreamingForChat(chatId);
    }
  }

  // Prepare streaming configuration for a specific chat
  prepareStreamingForChat(chatId: string): void {
    console.log('Preparing streaming for chat:', chatId);

    // You can customize streaming config based on chat context
    // For example, different avatars for different chat types
    this.customizeStreamingConfig(chatId);
  }

  // Customize streaming configuration based on chat context
  customizeStreamingConfig(chatId: string): void {
    // Get chat details to customize avatar/voice
    this.chatService.getChatByTwin(chatId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(chat => {
        if (chat) {
          // Example: Use different avatars based on chat topic or participants
          // if (chat.name?.toLowerCase().includes('business')) {
          //   this.streamingConfig.avatar_id = 'eric_public_pro2_20230608';
          // } else if (chat.name?.toLowerCase().includes('casual')) {
            this.streamingConfig.avatar_id = 'josh_lite3_20230714';
          // }

          // Update the streaming component configuration
          if (this.heygenStreamingComponent) {
            this.heygenStreamingComponent.updateConfig(this.streamingConfig);
          }
        }
      });
  }

  // Enhanced message sending with streaming integration
  onSendMessage(payload: any): void {
    this.currentChatId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((currentChatId: string | null) => {
        if (currentChatId) {
          // Send message to chat
          if (payload.text) {
            this.chatService.sendMessage(
              currentChatId,
              payload.text,
              payload.replyToMessageId
            ).subscribe({
              next: (response) => {
                console.log('Message sent:', response);

                // If streaming is active, also send to HeyGen
                if (this.isStreamingActive && payload.text) {
                  this.sendToHeyGenStreaming(payload.text, currentChatId);
                }
              },
              error: (error) => console.error('Error sending message:', error)
            });
          }
          // Handle voice/audio messages
          else if (payload.attachment && payload.attachment.type === 'audio') {
            this.fetchAudioBlob(payload.attachment.url).then(audioBlob => {
              if (audioBlob) {
                this.chatService.saveVoiceMessage(
                  currentChatId,
                  audioBlob,
                  payload.attachment.duration || 0,
                  payload.attachment.format || 'audio/webm',
                  payload.replyToMessageId
                ).subscribe({
                  next: (response) => console.log('Voice message sent successfully', response),
                  error: (error) => console.error('Error sending voice message:', error)
                });
              }
            });
          }
        }
      });
  }

  // Send message to HeyGen streaming
  sendToHeyGenStreaming(message: string, chatId: string): void {
    if (this.heygenStreamingComponent) {
      // Use the streaming component's method
      this.heygenStreamingComponent.sendMessageToStreaming(message);
    } else {
      // Direct service call
      this.heygenService.quickChatStream(message, chatId, this.streamingConfig)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Message sent to HeyGen streaming:', response);
            this.toasterService.success('Message sent to AI avatar');
          },
          error: (error) => {
            console.error('Error sending to HeyGen:', error);
            this.toasterService.error('Failed to send message to AI avatar');
          }
        });
    }
  }

  // Toggle streaming panel
  toggleStreamingPanel(): void {
    this.showStreamingPanel = !this.showStreamingPanel;

    if (this.showStreamingPanel) {
      // Prepare streaming for current chat if one is selected
      this.currentChatId$
        .pipe(takeUntil(this.destroy$))
        .subscribe(chatId => {
          if (chatId) {
            this.prepareStreamingForChat(chatId);
          }
        });
    } else {
      // Optionally stop streaming when panel is closed
      this.stopStreamingSession();
    }
  }

  // Start streaming session
  startStreamingSession(): void {
    this.currentChatId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(chatId => {
        if (chatId) {
          if (this.heygenStreamingComponent) {
            this.heygenStreamingComponent.startStreaming();
          } else {
            this.heygenService.startStreaming(this.streamingConfig)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (response) => {
                  console.log('Streaming started:', response);
                  this.toasterService.success('AI Avatar streaming started');
                },
                error: (error) => {
                  console.error('Error starting streaming:', error);
                  this.toasterService.error('Failed to start AI Avatar streaming');
                }
              });
          }
        } else {
          this.toasterService.warning('Please select a chat first');
        }
      });
  }

  // Stop streaming session
  stopStreamingSession(): void {
    if (this.heygenStreamingComponent) {
      this.heygenStreamingComponent.stopStreaming();
    } else {
      this.heygenService.stopStreaming()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Streaming stopped:', response);
            this.toasterService.info('AI Avatar streaming stopped');
          },
          error: (error) => {
            console.error('Error stopping streaming:', error);
            this.toasterService.error('Failed to stop AI Avatar streaming');
          }
        });
    }
  }

  // Generate content from chat and stream
  generateAndStreamFromChat(): void {
    this.currentChatId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(chatId => {
        if (chatId) {
          if (this.heygenStreamingComponent) {
            this.heygenStreamingComponent.generateAndStream();
          } else {
            this.heygenService.generateAndStream(chatId, this.streamingConfig, 'summary')
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (response) => {
                  console.log('Generated and streaming:', response);
                  this.toasterService.success('AI Avatar is presenting chat summary');
                },
                error: (error) => {
                  console.error('Error generating and streaming:', error);
                  this.toasterService.error('Failed to generate AI Avatar presentation');
                }
              });
          }
        } else {
          this.toasterService.warning('Please select a chat first');
        }
      });
  }

  // Handle streaming events from the component
  onStreamingEvent(event: any): void {
    switch (event.type) {
      case 'session_started':
        this.toasterService.success('AI Avatar streaming session started');
        break;
      case 'session_ended':
        this.toasterService.info('AI Avatar streaming session ended');
        break;
      case 'message_sent':
        console.log('Message sent to streaming:', event.data);
        break;
      case 'error':
        this.toasterService.error(`Streaming error: ${event.message}`);
        break;
      default:
        console.log('Streaming event:', event);
    }
  }

  createNewChat(): void {
    console.log('Creating new chat');
    // Implementation for creating new chat
  }

  private fetchAudioBlob(blobUrl: string | Blob): Promise<Blob | null> {
    if (blobUrl instanceof Blob) {
      return Promise.resolve(blobUrl);
    }

    if (blobUrl.startsWith('data:')) {
      try {
        const base64 = blobUrl.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const buffer = new ArrayBuffer(len);
        const view = new Uint8Array(buffer);

        for (let i = 0; i < len; i++) {
          view[i] = binary.charCodeAt(i);
        }

        const contentType = blobUrl.split(';')[0].split(':')[1] || 'audio/webm';
        return Promise.resolve(new Blob([buffer], { type: contentType }));
      } catch (e) {
        console.error('Error converting data URL to Blob:', e);
        return Promise.resolve(null);
      }
    }

    if (blobUrl.startsWith('blob:')) {
      return fetch(blobUrl)
        .then(response => response.blob())
        .catch(error => {
          console.error('Error fetching blob from URL:', error);
          return null;
        });
    }

    console.error('Invalid URL format:', blobUrl);
    return Promise.resolve(null);
  }

  showChatList(): void {
    this.chatService.selectChat('');
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpen = !this.settingsMenuOpen;
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpen = false;
  }

  goBack() {
    window.history.back();
  }

  // Report modal methods
  openReportModal(messageId: string): void {
    console.log('Opening report modal for message ID:', messageId);
    this.reportingMessageId = messageId;
    this.showReportModal = true;
  }

  closeReportModal(): void {
    this.showReportModal = false;
  }

  onSubmitReport(reportData: any): void {
    this.chatService.reportMessage(reportData, this.reportingMessageId).subscribe(
      (response) => {
        this.toasterService.success('Message reported successfully');
      },
      (error) => console.error('Error reporting message:', error)
    );
    this.closeReportModal();
  }

  ngOnDestroy(): void {
    // Stop streaming session if active
    if (this.isStreamingActive) {
      this.stopStreamingSession();
    }

    // Clean up websocket connection
    this.wsService.disconnect();

    // Complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
