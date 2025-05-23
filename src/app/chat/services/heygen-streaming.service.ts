// heygen-streaming.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

export interface StreamingSession {
  sessionId: string;
  livekit_url: string;
  livekit_token: string;
  session_id: string;
  isActive: boolean;
}

export interface StreamingMessage {
  text: string;
  timestamp: Date;
  type: 'user' | 'ai' | 'system';
}

export interface StreamingConfig {
  avatar_id: string;
  voice_id: string;
  language?: string;
  quality?: string;
  script?: string; // Added script to interface
}

export interface StreamingStatus {
  status: 'idle' | 'talking' | 'ready' | 'error';
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class HeyGenStreamingService {
  private apiUrl = `${environment.apiUrl}/messaging/heygen-streaming`;
  private socket: Socket | null = null;
  private currentSession: StreamingSession | null = null;

  // Observables for real-time updates
  private sessionStatusSubject = new BehaviorSubject<StreamingStatus>({ status: 'idle', message: 'Ready' });
  private messagesSubject = new BehaviorSubject<StreamingMessage[]>([]);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  public sessionStatus$ = this.sessionStatusSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Initialize socket connection for real-time updates
   */
  private initializeSocket(): void {
    if (this.socket) {
      return;
    }

    this.socket = io(environment.streamingServiceUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to streaming service');
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from streaming service');
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('avatar_status', (data: StreamingStatus) => {
      console.log('Avatar status:', data);
      this.sessionStatusSubject.next(data);
    });

    this.socket.on('stream_status', (data: StreamingStatus) => {
      console.log('Stream status:', data);
      this.sessionStatusSubject.next(data);
    });

    this.socket.on('stream_error', (error: any) => {
      console.error('Stream error:', error);
      this.sessionStatusSubject.next({
        status: 'error',
        message: error.error || 'Streaming error occurred'
      });
    });
  }

  /**
   * Start a new streaming session
   */
  startStreaming(config: StreamingConfig, script?: string): Observable<any> {
    // Use script from parameter or config, ensuring it's always present
    const finalScript = script || config.script;

    if (!finalScript || finalScript.trim().length === 0) {
      throw new Error('Script is required to start streaming session');
    }

    const payload = {
      avatar_id: config.avatar_id,
      voice_id: config.voice_id,
      language: config.language || 'en',
      quality: config.quality || 'high',
      script: finalScript.trim()
    };

    console.log('Sending streaming request with payload:', payload);

    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/start-streaming/`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: (response: any) => {
            console.log('API Response:', response);
            if (response.success) {
              this.currentSession = {
                sessionId: response.session_id,
                livekit_url: response.stream_info?.livekit_url,
                livekit_token: response.stream_info?.livekit_token,
                session_id: response.session_id,
                isActive: true
              };

              // Add the initial script as a system message
              this.addMessage({
                text: finalScript,
                timestamp: new Date(),
                type: 'system'
              });

              // Initialize socket and join session room
              this.initializeSocket();
              if (this.socket) {
                this.socket.emit('join_session', this.currentSession.sessionId);
              }

              this.sessionStatusSubject.next({
                status: 'ready',
                message: 'Streaming session started'
              });

              observer.next(response);
              observer.complete();
            } else {
              const errorMsg = response.error || 'Unknown error occurred';
              console.error('API returned error:', errorMsg);
              observer.error({ error: { error: errorMsg } });
            }
          },
          error: (error) => {
            console.error('HTTP Error starting streaming:', error);
            observer.error(error);
          }
        });
    });
  }

  /**
   * Send text to existing streaming session
   */
  sendText(text: string): Observable<any> {
    if (!this.currentSession) {
      throw new Error('No active streaming session');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text message cannot be empty');
    }

    const payload = {
      session_id: this.currentSession.sessionId,
      text: text.trim()
    };

    // Add message to local messages
    const userMessage: StreamingMessage = {
      text: text.trim(),
      timestamp: new Date(),
      type: 'user'
    };

    this.addMessage(userMessage);

    return this.http.post(`${this.apiUrl}/send-text/`, payload, { headers: this.getHeaders() });
  }

  /**
   * Quick chat: Send message and get AI response with streaming
   */
  quickChatStream(message: string, chatId: string, config: StreamingConfig): Observable<any> {
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    const payload = {
      message: message.trim(),
      chat_id: chatId,
      avatar_id: config.avatar_id,
      voice_id: config.voice_id,
      language: config.language || 'en'
    };

    // Add user message
    this.addMessage({
      text: message.trim(),
      timestamp: new Date(),
      type: 'user'
    });

    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/quick-chat-stream/`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: (response: any) => {
            console.log('Quick chat response:', response);
            if (response.success) {
              // Update current session
              this.currentSession = {
                sessionId: response.session_id,
                livekit_url: response.stream_info?.livekit_url,
                livekit_token: response.stream_info?.livekit_token,
                session_id: response.session_id,
                isActive: true
              };

              // Add AI response message
              if (response.ai_response) {
                this.addMessage({
                  text: response.ai_response,
                  timestamp: new Date(),
                  type: 'ai'
                });
              }

              // Initialize socket if needed
              this.initializeSocket();
              if (this.socket) {
                this.socket.emit('join_session', this.currentSession.sessionId);
              }

              this.sessionStatusSubject.next({
                status: 'ready',
                message: 'Quick chat session active'
              });

              observer.next(response);
              observer.complete();
            } else {
              const errorMsg = response.error || 'Quick chat failed';
              observer.error({ error: { error: errorMsg } });
            }
          },
          error: (error) => {
            console.error('Error in quick chat stream:', error);
            observer.error(error);
          }
        });
    });
  }

  /**
   * Generate script from chat conversation
   */
  generateScript(chatId: string, scriptType: string = 'summary', contextMessages: number = 10): Observable<any> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    const payload = {
      chat_id: chatId,
      script_type: scriptType,
      context_messages: contextMessages
    };

    return this.http.post(`${this.apiUrl}/generate-script/`, payload, { headers: this.getHeaders() });
  }

  /**
   * Generate script and start streaming in one call
   */
  generateAndStream(chatId: string, config: StreamingConfig, scriptType: string = 'summary'): Observable<any> {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    const payload = {
      chat_id: chatId,
      avatar_id: config.avatar_id,
      voice_id: config.voice_id,
      script_type: scriptType,
      language: config.language || 'en',
      quality: config.quality || 'high'
    };

    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/generate-and-stream/`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: (response: any) => {
            console.log('Generate and stream response:', response);
            if (response.success) {
              this.currentSession = {
                sessionId: response.session_id,
                livekit_url: response.stream_info?.livekit_url,
                livekit_token: response.stream_info?.livekit_token,
                session_id: response.session_id,
                isActive: true
              };

              // Add generated script as AI message
              if (response.script_preview) {
                this.addMessage({
                  text: response.script_preview,
                  timestamp: new Date(),
                  type: 'ai'
                });
              }

              this.initializeSocket();
              if (this.socket) {
                this.socket.emit('join_session', this.currentSession.sessionId);
              }

              this.sessionStatusSubject.next({
                status: 'ready',
                message: 'Generated content streaming session started'
              });

              observer.next(response);
              observer.complete();
            } else {
              const errorMsg = response.error || 'Generate and stream failed';
              observer.error({ error: { error: errorMsg } });
            }
          },
          error: (error) => {
            console.error('Error in generate and stream:', error);
            observer.error(error);
          }
        });
    });
  }

  /**
   * Stop current streaming session
   */
  stopStreaming(): Observable<any> {
    if (!this.currentSession) {
      throw new Error('No active streaming session');
    }

    const payload = {
      session_id: this.currentSession.sessionId
    };

    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/stop-streaming/`, payload, { headers: this.getHeaders() })
        .subscribe({
          next: (response) => {
            console.log('Stop streaming response:', response);
            this.cleanup();
            this.sessionStatusSubject.next({
              status: 'idle',
              message: 'Session stopped'
            });
            observer.next(response);
            observer.complete();
          },
          error: (error) => {
            console.error('Error stopping streaming:', error);
            this.cleanup();
            observer.error(error);
          }
        });
    });
  }

  /**
   * Get active streaming sessions
   */
  getActiveSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/active-sessions/`, { headers: this.getHeaders() });
  }

  /**
   * Check service health
   */
  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health/`, { headers: this.getHeaders() });
  }

  /**
   * Get current session info
   */
  getCurrentSession(): StreamingSession | null {
    return this.currentSession;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSession?.isActive || false;
  }

  /**
   * Add message to the messages stream
   */
  private addMessage(message: StreamingMessage): void {
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.socket) {
      if (this.currentSession) {
        this.socket.emit('leave_session', this.currentSession.sessionId);
      }
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentSession = null;
    this.connectionStatusSubject.next(false);
  }

  /**
   * Destroy service - cleanup all resources
   */
  ngOnDestroy(): void {
    this.cleanup();
  }
}
