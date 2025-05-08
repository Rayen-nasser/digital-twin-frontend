import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, switchMap, tap, filter, catchError, finalize, distinctUntilChanged } from 'rxjs/operators';
import { Chat } from '../models/chat.model';
import { Message } from '../models/message.model';
import { environment } from '../../../environments/environment';
import { WebsocketService } from './websocket.service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = environment.apiUrl + '/messaging';

  // State management
  private currentChatIdSubject = new BehaviorSubject<string | null>(null);
  public currentChatId$ = this.currentChatIdSubject.asObservable().pipe(
    distinctUntilChanged()
  );

  private chatsSubject = new BehaviorSubject<Chat[]>([]);
  public chats$ = this.chatsSubject.asObservable();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private typingIndicatorSubject = new BehaviorSubject<boolean>(false);
  public typingIndicator$ = this.typingIndicatorSubject.asObservable();

  // Loading states
  private loadingChatsSubject = new BehaviorSubject<boolean>(false);
  public loadingChats$ = this.loadingChatsSubject.asObservable();

  private loadingMessagesSubject = new BehaviorSubject<boolean>(false);
  public loadingMessages$ = this.loadingMessagesSubject.asObservable();

  // Message deduplication cache
  private messageDeduplicationCache = new Set<string>();
  readonly currentChat$ = this.currentChatIdSubject.asObservable();

  constructor(
    private http: HttpClient,
    private wsService: WebsocketService
  ) {
    this.setupWebSocketListeners();
    this.setupChatSelectionListener();
  }

  // Initialize websocket listeners
  private setupWebSocketListeners(): void {
    // Connection status
    this.wsService.connectionStatus().subscribe(connected => {
      console.log('WebSocket connection status:', connected);
    });

    // New messages
    this.wsService.newMessages().subscribe(message => {
      if (message) this.handleNewMessage(message);
    });

    // Typing indicators
    this.wsService.typingIndicator().subscribe(isTyping => {
      this.typingIndicatorSubject.next(isTyping);
    });
  }

  // Setup chat selection listener
  private setupChatSelectionListener(): void {
    this.currentChatId$.pipe(
      filter(chatId => chatId !== null)
    ).subscribe(chatId => {
      if (chatId && !this.wsService.isConnected()) {
        this.wsService.connect(chatId);
      }
    });
  }

  // Get the current chat ID
  getCurrentChatId(): string | null {
    return this.currentChatIdSubject.value;
  }

  getChatByTwin(twinId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chats/?twin=${twinId}`);
  }

  // Fetch all chats
  loadChats(): Observable<Chat[]> {
    this.loadingChatsSubject.next(true);

    return this.http.get<any>(`${this.apiUrl}/chats/`).pipe(
      map((response: any) => response.results || response),
      tap((chats) => {
        const sortedChats = this.sortChatsByLastActive(chats);
        this.chatsSubject.next(sortedChats);
      }),
      catchError(error => {
        console.error('Error loading chats:', error);
        return of([]);
      }),
      finalize(() => this.loadingChatsSubject.next(false))
    );
  }

  // Sort chats by last_active date
  private sortChatsByLastActive(chats: Chat[]): Chat[] {
    return [...chats].sort((a, b) => {
      const dateA = new Date(a.last_active || 0).getTime();
      const dateB = new Date(b.last_active || 0).getTime();
      return dateB - dateA;
    });
  }

  CreateChat(data: {twin: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/chats/`, data);
  }

  // Get messages using cursor-based pagination
  getMessages(chatId: string, pageSize: number = 25): Observable<any> {
    this.loadingMessagesSubject.next(true);

    return this.http.get<any>(
      `${this.apiUrl}/messages/chat_history/?chat=${chatId}&page_size=${pageSize}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching messages:', error);
        return of({ results: [], next: null });
      }),
      finalize(() => this.loadingMessagesSubject.next(false))
    );
  }

  // Get messages using cursor-based pagination
  getMessagesByCursor(chatId: string, cursor: string, pageSize: number = 25): Observable<any> {
    this.loadingMessagesSubject.next(true);

    return this.http.get<any>(
      `${this.apiUrl}/messages/chat_history/?chat=${chatId}&cursor=${cursor}&page_size=${pageSize}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching messages by cursor:', error);
        return of({ results: [], next: null });
      }),
      finalize(() => this.loadingMessagesSubject.next(false))
    );
  }

  // Fetch messages for a specific chat
  loadMessages(chatId: string): Observable<Message[]> {
    this.loadingMessagesSubject.next(true);
    this.messageDeduplicationCache.clear();
    this.messagesSubject.next([]);  // Clear messages before loading new ones

    return this.http.get<any>(`${this.apiUrl}/messages/chat_history/?chat=${chatId}`).pipe(
      map((response) => response.results || response),
      tap((messages) => {
        // Fix: Sort messages by date (oldest first for display)
        const sortedMessages = this.sortMessagesByTimestamp(messages);
        sortedMessages.forEach(msg => {
          if (msg.id) this.messageDeduplicationCache.add(msg.id);
        });

        this.messagesSubject.next(sortedMessages);
        this.currentChatIdSubject.next(chatId);
      }),
      catchError(error => {
        console.error('Error loading messages:', error);
        return of([]);
      }),
      finalize(() => this.loadingMessagesSubject.next(false))
    );
  }

  // Mark messages as read
  markMessagesAsRead(chatId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/chats/${chatId}/mark_messages_read/`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error marking messages as read:', error);
        return of(null);
      })
    );
  }

  // Send a message
  sendMessage(chatId: string, text_content: string): Observable<Message> {
    if (!text_content.trim()) {
      return of({} as Message);
    }

    // Create optimistic message
    const optimisticMessage: Message = {
      id: 'temp-' + new Date().getTime(),
      chat: chatId,
      text_content,
      message_type: 'text',
      is_from_user: true,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
      status: 'sent',
      status_updated_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      is_translated: false,
      reactions: [],
    };

    this.addMessageToList(optimisticMessage);
    this.updateChatWithLatestMessage(chatId, optimisticMessage);

    // Ensure WebSocket connection
    this.ensureWebSocketConnection(chatId, () => {
      this.wsService.sendMessage(text_content);
    });

    return of(optimisticMessage);
  }

  // Ensure WebSocket connection
  private ensureWebSocketConnection(chatId: string, onConnected: () => void): void {
    if (this.wsService.isConnected()) {
      onConnected();
      return;
    }

    this.wsService.connect(chatId);
    setTimeout(() => {
      if (this.wsService.isConnected()) {
        onConnected();
      } else {
        // Still try to send even if connection failed (will be queued)
        onConnected();
      }
    }, 500);
  }

  // Select a chat
  selectChat(chatId: string): void {
    // Handle empty chat ID (e.g., mobile view navigation)
    if (!chatId) {
      this.currentChatIdSubject.next(null);
      this.resetMessages();
      this.wsService.disconnect();
      return;
    }

    if (this.currentChatIdSubject.value === chatId) {
      this.checkWebSocketConnection(chatId);
      return;
    }

    // Disconnect from previous WebSocket
    this.wsService.disconnect();
    this.resetMessages();

    // Update the current chat ID first
    this.currentChatIdSubject.next(chatId);

    // Load messages for the selected chat
    this.loadMessages(chatId).subscribe({
      next: () => {
        this.wsService.connect(chatId);
        this.markMessagesAsRead(chatId).subscribe();
      },
      error: (error) => console.error('Error loading messages:', error)
    });
  }

  // Check WebSocket connection
  checkWebSocketConnection(chatId: string): void {
    if (!this.wsService.isConnected()) {
      this.wsService.connect(chatId);
    }
  }

  // Handle new messages from WebSocket
  private handleNewMessage(message: Message): void {
    if (!message || !message.id) {
      return;
    }

    // Prevent duplicate messages
    if (this.messageDeduplicationCache.has(message.id)) {
      return;
    }

    this.messageDeduplicationCache.add(message.id);
    const existingMessages = this.messagesSubject.value;

    // For user messages, replace any matching temp message
    if (message.is_from_user) {
      const tempMessageIndex = existingMessages.findIndex(msg =>
        msg.id?.startsWith('temp-') &&
        msg.text_content === message.text_content &&
        msg.is_from_user === true
      );

      if (tempMessageIndex >= 0) {
        const updatedMessages = [...existingMessages];
        updatedMessages[tempMessageIndex] = message;
        this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages));
      } else {
        this.addMessageToList(message);
      }
    } else {
      this.addMessageToList(message);
      if (message.id) {
        this.wsService.sendReadReceipt(message.id);
      }
    }

    // Update the chat list
    if (message.chat) {
      this.updateChatWithLatestMessage(message.chat, message);
    }
  }

  // Get a specific chat by ID
  getChat(chatId: string): Observable<Chat> {
    return this.http.get<Chat>(`${this.apiUrl}/chats/${chatId}/`).pipe(
      catchError(error => {
        console.error('Error getting chat:', error);
        return of({} as Chat);
      })
    );
  }

  // Create a new chat with an AI assistant
  createChat(assistantId: string): Observable<Chat> {
    return this.http.post<Chat>(`${this.apiUrl}/chats/`, {
      twin_id: assistantId
    }).pipe(
      tap(newChat => {
        const currentChats = this.chatsSubject.value;
        this.chatsSubject.next([newChat, ...currentChats]);
      }),
      switchMap(newChat => {
        this.selectChat(newChat.id);
        return this.getChat(newChat.id);
      }),
      catchError(error => {
        console.error('Error creating chat:', error);
        return of({} as Chat);
      })
    );
  }

  // Update user typing status
  updateTypingStatus(isTyping: boolean): void {
    if (this.wsService.isConnected()) {
      this.wsService.sendTypingIndicator(isTyping);
      return;
    }

    const currentChatId = this.currentChatIdSubject.value;
    if (currentChatId) {
      this.ensureWebSocketConnection(currentChatId, () => {
        this.wsService.sendTypingIndicator(isTyping);
      });
    }
  }

  // Add a message to the messages list
  private addMessageToList(message: Message): void {
    const currentMessages = this.messagesSubject.value;

    // Check if message already exists
    const messageExists = currentMessages.some(msg =>
      msg.id === message.id ||
      (msg.id?.startsWith('temp-') &&
       msg.text_content === message.text_content &&
       msg.is_from_user === message.is_from_user)
    );

    if (!messageExists) {
      const updatedMessages = [...currentMessages, message];  // Add to end for chronological order
      this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages));
    }
  }

  // Update a chat's last message in the list
  private updateChatWithLatestMessage(chatId: string, message: Message): void {
    const chats = this.chatsSubject.value;
    const chatIndex = chats.findIndex((chat) => chat.id === chatId);

    if (chatIndex > -1) {
      const updatedChat = {
        ...chats[chatIndex],
        last_message: {
          id: message.id,
          text_content: message.text_content || '',
          message_type: message.message_type,
          created_at: message.created_at,
          is_from_user: message.is_from_user,
          is_delivered: message.is_delivered || false,
          is_read: message.is_read || false,
        },
        last_active: new Date().toISOString(),
      };

      // Put this chat at the top of the list
      const updatedChats = [
        updatedChat,
        ...chats.filter((chat) => chat.id !== chatId),
      ];

      this.chatsSubject.next(updatedChats);
    }
  }

  // Sort messages by date (oldest first - for display)
  private sortMessagesByTimestamp(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
      return timeA - timeB;
    });
  }

  translateMessage(chatId: string, messageId: string): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/messages/${messageId}/translate/`, {}).pipe(
      catchError(error => {
        console.error('Error translating message:', error);
        return of({} as Message);
      })
    );
  }

  deleteMessage(chatId: string, messageId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/messages/${messageId}/`).pipe(
      tap(() => {
        // Remove message from local state
        const currentMessages = this.messagesSubject.value;
        const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
        this.messagesSubject.next(updatedMessages);

        // Remove from deduplication cache
        this.messageDeduplicationCache.delete(messageId);
      }),
      catchError(error => {
        console.error('Error deleting message:', error);
        return of(null);
      })
    );
  }

  addReaction(chatId: string, messageId: string, emoji: string): Observable<Message> {
    const url = `${this.apiUrl}/messages/${messageId}/reactions/`;
    return this.http.post<Message>(url, { emoji }).pipe(
      catchError(error => {
        console.error('Error adding reaction:', error);
        return of({} as Message);
      })
    );
  }

  // Reset messages state (e.g., when switching chats)
  resetMessages(): void {
    this.messagesSubject.next([]);
    this.messageDeduplicationCache.clear();
  }

  // Process and handle a new incoming message (e.g. from WebSocket)
  processIncomingMessage(message: Message): void {
    // Skip if we've already seen this message
    if (message.id && this.messageDeduplicationCache.has(message.id)) {
      return;
    }

    // Add to deduplication cache
    if (message.id) {
      this.messageDeduplicationCache.add(message.id);
    }

    // Add to messages
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = [...currentMessages, message];
    this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages));
  }

  // Clean up old messages from cache (call periodically or when changing chats)
  cleanupMessageCache(): void {
    // Keep only the most recent N messages to prevent memory leaks
    const maxCachedMessages = 500;
    const currentMessages = this.messagesSubject.value;

    if (currentMessages.length > maxCachedMessages) {
      const recentMessages = currentMessages.slice(-maxCachedMessages);
      this.messagesSubject.next(recentMessages);

      // Reset deduplication cache with only IDs from recent messages
      this.messageDeduplicationCache.clear();
      recentMessages.forEach(msg => {
        if (msg.id) this.messageDeduplicationCache.add(msg.id);
      });
    }
  }
}
