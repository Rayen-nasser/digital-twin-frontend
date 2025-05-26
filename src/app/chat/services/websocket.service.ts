import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/service/auth.service';

export interface WebSocketMessage {
  type: string;
  [key: string]: any; // Allow for flexible message properties
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private typingIndicatorSubject = new BehaviorSubject<boolean>(false);
  private newMessagesSubject = new ReplaySubject<any>(10); // Buffer recent messages

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private typingTimeout: any = null;
  private currentChatId: string | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting = false; // Flag to prevent multiple connection attempts
  private heartbeatInterval: any = null;
  private lastHeartbeatTime = 0;

  // Add a debug flag
  private debug = true;

  constructor(private authService: AuthService) {}

  // Debug logger
  private log(message: string, data?: any, wsMessage?: WebSocketMessage): void {
    if (this.debug) {
      if (data) {
        console.log(`[WebSocket] ${message}`, data);
      } else {
        console.log(`[WebSocket] ${message}`);
      }
    }
  }

  // Observable streams
  public messages(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  public connectionStatus(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  public typingIndicator(): Observable<boolean> {
    return this.typingIndicatorSubject.asObservable();
  }

  public newMessages(): Observable<any> {
    return this.newMessagesSubject.asObservable();
  }

  /**
   * Connect to the WebSocket for a specific chat
   */
  public connect(chatId: string): void {
    this.log(`Attempting to connect to chat: ${chatId}`);

    // If already connecting, prevent duplicate connections
    if (this.isConnecting) {
      this.log('Connection attempt already in progress, skipping');
      return;
    }

    // If already connected to the same chat, don't reconnect
    if (this.socket &&
        this.socket.readyState === WebSocket.OPEN &&
        this.currentChatId === chatId) {
      this.log(`Already connected to chat ${chatId}`);
      return;
    }

    // Set connecting flag
    this.isConnecting = true;

    // Store the current chat ID for reconnection purposes
    this.currentChatId = chatId;

    // Clear any existing reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close existing socket if any
    this.closeExistingConnection();

    // Get the JWT token
    const token = this.authService.getAccessToken();

    if (!token) {
      console.error('No authentication token available');
      this.connectionStatusSubject.next(false);
      this.isConnecting = false;
      return;
    }

    // Construct WebSocket URL
    const wsUrl = this.buildWebSocketUrl(chatId, token);
    this.log(`Connecting to WebSocket: ${wsUrl}`);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => this.handleSocketOpen(chatId);
      this.socket.onmessage = (event) => this.handleSocketMessage(event);
      this.socket.onclose = (event) => this.handleSocketClose(event);
      this.socket.onerror = (event) => this.handleSocketError(event);

      // Set a timeout to detect connection failures
      setTimeout(() => {
        if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timed out');
          if (this.socket.readyState === WebSocket.CONNECTING) {
            this.socket.close();
            this.handleSocketClose({ code: 4000, reason: 'Connection timeout', wasClean: false } as CloseEvent);
          }
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.connectionStatusSubject.next(false);
      this.isConnecting = false;
    }
  }

/**
 * Send a text message through the WebSocket
 * Updated to support reply functionality
 */
public sendMessage(content: string, replyToMessageId?: string): void {
  if (!content || content.trim() === '') {
    this.log('Attempted to send empty message');
    return;
  }

  // Create message payload with optional reply_to field
  const messagePayload: any = {
    type: 'text',
    content: content.trim()
  };

  // Add reply_to if provided
  if (replyToMessageId) {
    messagePayload.reply_to = replyToMessageId;
  }

  // Try all possible message formats that the server might accept
  this.tryMessageFormat({
    type: 'chat_message',
    ...messagePayload
  });

  // Make sure we're connected
  this.ensureConnection();

  // Stop typing indicator when sending a message
  this.sendTypingIndicator(false);
}

  /**
   * Try different message formats to find one that works
   */
  private tryMessageFormat(message: WebSocketMessage): void {
    this.log('Trying message format:', message);

    // Send the original format
    this.sendOrQueueMessage(message);

    // Try alternate formats if the first one doesn't work
    // We'll set timeouts to try different formats
    setTimeout(() => {
      // Check if we still need to try another format (e.g. if no response received)
      // For text messages, try these additional formats
      if (message.type === 'chat_message') {
        // Try format 2
        this.sendOrQueueMessage({
          type: 'message',
          content: message['content']
        });

        // Try format 3
        setTimeout(() => {
          this.sendOrQueueMessage({
            type: 'text',
            content: message['content']
          });
        }, 500);
      }
    }, 500);
  }

  /**
   * Send a typing indicator
   */
  public sendTypingIndicator(isTyping: boolean): void {
    // Try both formats for typing indicator
    this.sendOrQueueMessage({
      type: 'typing',
      is_typing: isTyping
    });

    // Also try alternative format
    setTimeout(() => {
      this.sendOrQueueMessage({
        type: 'typing_indicator',
        is_typing: isTyping
      });
    }, 200);

    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set timeout to stop typing indicator after 3 seconds of inactivity
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.sendTypingIndicator(false);
      }, 3000);
    }
  }

  /**
   * Ensure we have a connection
   */
  private ensureConnection(): void {
    if (!this.isConnected() && this.currentChatId && !this.isConnecting) {
      this.log('No active connection, reconnecting...');
      this.connect(this.currentChatId);
    }
  }

  /**
   * Send a read receipt for a message
   */
  public sendReadReceipt(messageId: string): void {
    if (!messageId) {
      this.log('Attempted to send read receipt without message ID');
      return;
    }

    const message: WebSocketMessage = {
      type: 'read_receipt',
      message_ids: [messageId]
    };

    this.sendOrQueueMessage(message);
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.log('Disconnecting WebSocket');
    this.currentChatId = null;

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.closeExistingConnection();
  }

  /**
   * Get current connection state
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Send a heartbeat to keep the connection alive
   */
  private sendHeartbeat(): void {
    // Only send a heartbeat if we haven't sent one recently
    const now = Date.now();
    if (now - this.lastHeartbeatTime < 20000) { // 20 seconds
      return;
    }

    this.lastHeartbeatTime = now;
    this.log('Sending heartbeat');

    // Try different heartbeat formats
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        // Send as plain text (some servers accept this)
        this.socket.send('ping');

        // Also try as JSON (other servers prefer this)
        setTimeout(() => {
          this.sendToSocket({
            type: 'heartbeat'
          });
        }, 100);
      } catch (error) {
        this.log('Error sending heartbeat:', error);
      }
    }
  }

  /**
   * Close existing WebSocket connection
   */
  private closeExistingConnection(): void {
    if (this.socket) {
      try {
        // Only attempt to close if not already closed
        if (this.socket.readyState !== WebSocket.CLOSED) {
          this.log('Closing existing websocket connection');
          this.socket.close(1000, 'User disconnected');
        }
      } catch (e) {
        console.error('Error closing websocket:', e);
      } finally {
        this.socket = null;
        this.connectionStatusSubject.next(false);
      }
    }
  }

  /**
   * Build WebSocket URL
   */
  private buildWebSocketUrl(chatId: string, token: string): string {
    // Determine protocol based on current page protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Use environment-specific hostname
    const hostname = environment.production
      ? window.location.host  // Use current host in production
      : 'localhost:8001';     // Use development server in dev mode

    // Construct WebSocket URLgit 
    return `${wsProtocol}//${hostname}/api/v1/messaging/ws/chat/${chatId}/?token=${token}`;
  }

  /**
   * Handle WebSocket open event
   */
  private handleSocketOpen(chatId: string): void {
    this.log('WebSocket connection established successfully');
    this.connectionStatusSubject.next(true);
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    // Try different connection messages to notify the server
    // Try format 1
    this.sendToSocket({
      type: 'join_chat',
      chat_id: chatId
    });

    // Try format 2
    setTimeout(() => {
      this.sendToSocket({
        type: 'connection_established',
        chat_id: chatId
      });
    }, 200);

    // Process any messages that were queued during disconnection
    this.processMessageQueue();

    // Setup heartbeat interval to keep connection alive
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Handle WebSocket message event
   */
  private handleSocketMessage(event: MessageEvent): void {
    try {
      // Handle string responses
      if (typeof event.data === 'string' &&
          (event.data === 'pong' ||
           event.data === 'heartbeat_ack' ||
           event.data === 'ping')) {
        this.log('Received heartbeat response from server');
        return;
      }

      // Parse JSON messages
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        this.log('Received non-JSON message:', event.data);
        return;
      }

      this.log('WebSocket message received:', message);

      // First, broadcast the raw message to all subscribers
      this.messageSubject.next(message);

      // Then process specific message types
      this.processIncomingMessage(message);
    } catch (error) {
      console.error('Error handling WebSocket message:', error, event.data);
    }
  }

  /**
   * Process different types of incoming messages
   */
  private processIncomingMessage(message: WebSocketMessage): void {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'join_chat':
      case 'connection_established':
        this.log('Connection confirmed by server:', message);
        break;

      case 'message':
      case 'chat_message':
      case 'text':
        // Try to find the message content in various possible locations
        let msgData = null;

        if (message['message']) {
          msgData = message['message'];
        } else if (message['data'] && message['data']['message']) {
          msgData = message['data']['message'];
        } else if (message['content']) {
          // Direct content (for messages we send)
          msgData = {
            content: message['content'],
            created_at: new Date().toISOString(),
            id: 'temp-' + Date.now(),
            is_from_user: true,
            text_content: message['content']
          };
        }

        if (msgData) {
          this.log('Extracted message data:', msgData);
          // Emit the new message to subscribers
          this.newMessagesSubject.next(msgData);
        } else {
          this.log('Could not extract message data from:', message);
        }
        break;

      case 'typing':
      case 'typing_indicator':
        const isTyping =
          message['is_typing'] !== undefined ? message['is_typing'] :
          message['data']?.is_typing !== undefined ? message['data'].is_typing :
          false;

        // Only process typing indicators from the other party (not our own echoes)
        if (!message['user_id'] || message['user_id'] === 'twin' || message['user_id'] !== 'user') {
          this.log('Typing indicator received:', isTyping);
          this.typingIndicatorSubject.next(isTyping);
        }
        break;

      case 'read_receipt':
        this.log('Read receipt received:', message);
        break;

      case 'error':
        // Capture the error message
        const errorMsg = message['message'] || 'Unknown error';
        console.error('WebSocket error message:', errorMsg);

        // If this is a ping-related error, adapt our ping strategy
        if (errorMsg.includes('ping') || errorMsg.includes('heartbeat')) {
          this.log('Ping strategy error detected, will adjust ping method');
          // Clear current heartbeat interval
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
        }
        break;

      case 'heartbeat_ack':
      case 'pong':
        this.log('Heartbeat acknowledged');
        break;

      default:
        this.log('Unhandled message type:', message.type, message);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleSocketClose(event: CloseEvent): void {
    this.log('WebSocket connection closed', event);
    this.connectionStatusSubject.next(false);
    this.isConnecting = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Attempt to reconnect after a delay if not closed cleanly
    if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff with max 30s
      this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

      this.reconnectTimer = setTimeout(() => {
        if (this.currentChatId) {
          this.connect(this.currentChatId);
        }
      }, delay);
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleSocketError(error: Event): void {
    console.error('WebSocket error:', error);
    // Don't set isConnecting to false here, let onClose handle it
  }

  /**
   * Process queued messages when connection is established
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.log(`Processing ${this.messageQueue.length} queued messages`);

      // Process all queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.sendToSocket(message);
        }
      }
    }
  }

  /**
   * Send or queue a message depending on connection state
   */
  private sendOrQueueMessage(message: WebSocketMessage): void {
    // Add timestamp for debugging
    const messageWithTimestamp = {
      ...message,
      _clientTimestamp: new Date().toISOString()
    };

    // Try to send immediately if connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendToSocket(messageWithTimestamp);
    }
    // Otherwise, queue the message for later
    else {
      this.log('WebSocket not connected. Queueing message:', messageWithTimestamp);
      this.messageQueue.push(messageWithTimestamp);

      // Try to reconnect if not already trying
      if (this.currentChatId && !this.reconnectTimer && !this.isConnecting &&
          (!this.socket || this.socket.readyState === WebSocket.CLOSED)) {
        this.log('Initiating reconnection due to queued message');
        this.reconnectAttempts = 0; // Reset attempts since this is a user-initiated action
        this.connect(this.currentChatId);
      }
    }
  }

  /**
   * Send a message to the WebSocket
   */
  private sendToSocket(message: WebSocketMessage): void {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const messageStr = JSON.stringify(message);
        this.log('Sending to WebSocket:', message);
        this.socket.send(messageStr);

        // For text/chat messages, also create a local "echo" to ensure UI updates
        if (message.type === 'chat_message' || message.type === 'message' || message.type === 'text') {
          // Create temporary message for immediate UI feedback
          const tempMessage = {
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
            is_from_user: true,
            text_content: message['content'],
            content: message['content'],
            is_delivered: false,
            is_read: false
          };

          this.log('Creating local message echo:', tempMessage);
          this.newMessagesSubject.next(tempMessage);
        }
      } else {
        throw new Error(`Cannot send message, socket state: ${this.socket ? this.socket.readyState : 'null'}`);
      }
    } catch (error) {
      console.error('Error sending message to WebSocket:', error);
      // Queue the message if sending fails
      this.messageQueue.push(message);
    }
  }
}
