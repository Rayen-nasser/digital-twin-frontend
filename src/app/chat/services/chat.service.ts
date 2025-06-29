import { Injectable } from "@angular/core"
import { HttpClient } from "@angular/common/http"
import { BehaviorSubject, type Observable, of, throwError } from "rxjs"
import { map, switchMap, tap, filter, catchError, finalize, distinctUntilChanged } from "rxjs/operators"
import type { Chat } from "../models/chat.model"
import type { Message } from "../models/message.model"
import { environment } from "../../../environments/environment"
import { WebsocketService } from "./websocket.service"

@Injectable({
  providedIn: "root",
})
export class ChatService {
  // API endpoint
  private apiUrl = environment.apiUrl + "/messaging"

  // State management
  private currentChatIdSubject = new BehaviorSubject<string | null>(null)
  public currentChatId$ = this.currentChatIdSubject.asObservable().pipe(distinctUntilChanged())

  private chatsSubject = new BehaviorSubject<Chat[]>([])
  public chats$ = this.chatsSubject.asObservable()
  private chatArchivedSubject = new BehaviorSubject<string | null>(null)

  private messagesReadSubject = new BehaviorSubject<string | null>(null)
  public messagesRead$ = this.messagesReadSubject.asObservable().pipe(filter((chatId) => chatId !== null))

  private messagesSubject = new BehaviorSubject<Message[]>([])
  public messages$ = this.messagesSubject.asObservable()

  private typingIndicatorSubject = new BehaviorSubject<boolean>(false)
  public typingIndicator$ = this.typingIndicatorSubject.asObservable()

  // Loading states
  private loadingChatsSubject = new BehaviorSubject<boolean>(false)
  public loadingChats$ = this.loadingChatsSubject.asObservable()

  private loadingMessagesSubject = new BehaviorSubject<boolean>(false)
  public loadingMessages$ = this.loadingMessagesSubject.asObservable()

  // Message deduplication cache
  private messageDeduplicationCache = new Set<string>()
  readonly currentChat$ = this.currentChatIdSubject.asObservable()

  // Keep track of the message being replied to
  private replyToMessageSubject = new BehaviorSubject<Message | null>(null)
  public replyToMessage$ = this.replyToMessageSubject.asObservable()

  constructor(
    private http: HttpClient,
    private wsService: WebsocketService,
  ) {
    this.setupWebSocketListeners()
    this.setupChatSelectionListener()
  }

  // Initialize websocket listeners
  private setupWebSocketListeners(): void {
    // Connection status
    this.wsService.connectionStatus().subscribe((connected) => {
      console.log("WebSocket connection status:", connected)
    })

    // New messages
    this.wsService.newMessages().subscribe((message) => {
      if (message) this.handleNewMessage(message)
    })

    // Typing indicators
    this.wsService.typingIndicator().subscribe((isTyping) => {
      this.typingIndicatorSubject.next(isTyping)
    })
  }

  // Setup chat selection listener
  private setupChatSelectionListener(): void {
    this.currentChatId$.pipe(filter((chatId) => chatId !== null)).subscribe((chatId) => {
      if (chatId && !this.wsService.isConnected()) {
        this.wsService.connect(chatId)
      }
    })
  }

  // Get the current chat ID
  getCurrentChatId(): string | null {
    return this.currentChatIdSubject.value
  }

  getChatByTwin(twinId: string): Observable<any> {
    // No need to pass currentUserId as the backend will use the authenticated user
    return this.http
      .get<any>(`${this.apiUrl}/chats/`, {
        params: { twin: twinId },
      })
      .pipe(
        map((response) => {
          // Check if any results were returned
          if (response.results && response.results.length > 0) {
            // Chat exists, return the first chat object
            return response.results[0]
          } else {
            // No chat exists between this user and twin
            return null
          }
        }),
      )
  }

  // Fetch all chats
  loadChats(): Observable<Chat[]> {
    this.loadingChatsSubject.next(true)

    return this.http.get<any>(`${this.apiUrl}/chats/`).pipe(
      map((response: any) => response.results || response),
      tap((chats) => {
        const sortedChats = this.sortChatsByLastActive(chats)
        this.chatsSubject.next(sortedChats)
      }),
      catchError((error) => {
        console.error("Error loading chats:", error)
        return of([])
      }),
      finalize(() => this.loadingChatsSubject.next(false)),
    )
  }

  // Sort chats by last_active date
  private sortChatsByLastActive(chats: Chat[]): Chat[] {
    return [...chats].sort((a, b) => {
      const dateA = new Date(a.last_active || 0).getTime()
      const dateB = new Date(b.last_active || 0).getTime()
      return dateB - dateA
    })
  }

  CreateChat(data: { twin: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/chats/`, data)
  }

  // Get messages using cursor-based pagination
  getMessages(chatId: string, pageSize = 25): Observable<any> {
    this.loadingMessagesSubject.next(true)

    return this.http.get<any>(`${this.apiUrl}/messages/chat_history/?chat=${chatId}&page_size=${pageSize}`).pipe(
      catchError((error) => {
        console.error("Error fetching messages:", error)
        return of({ results: [], next: null })
      }),
      finalize(() => this.loadingMessagesSubject.next(false)),
    )
  }

  // Get messages using cursor-based pagination
  getMessagesByCursor(chatId: string, cursor: string, pageSize = 25): Observable<any> {
    this.loadingMessagesSubject.next(true)

    return this.http
      .get<any>(`${this.apiUrl}/messages/chat_history/?chat=${chatId}&cursor=${cursor}&page_size=${pageSize}`)
      .pipe(
        catchError((error) => {
          console.error("Error fetching messages by cursor:", error)
          return of({ results: [], next: null })
        }),
        finalize(() => this.loadingMessagesSubject.next(false)),
      )
  }

  // Fetch messages for a specific chat
  loadMessages(chatId: string): Observable<Message[]> {
    this.loadingMessagesSubject.next(true)
    this.messageDeduplicationCache.clear()
    this.messagesSubject.next([]) // Clear messages before loading new ones

    return this.http.get<any>(`${this.apiUrl}/messages/chat_history/?chat=${chatId}`).pipe(
      map((response) => response.results || response),
      tap((messages) => {
        // Fix: Sort messages by date (oldest first for display)
        const sortedMessages = this.sortMessagesByTimestamp(messages)
        sortedMessages.forEach((msg) => {
          if (msg.id) this.messageDeduplicationCache.add(msg.id)
        })

        this.messagesSubject.next(sortedMessages)
        this.currentChatIdSubject.next(chatId)
      }),
      catchError((error) => {
        console.error("Error loading messages:", error)
        return of([])
      }),
      finalize(() => this.loadingMessagesSubject.next(false)),
    )
  }

  // Mark messages as read
  markMessagesAsRead(chatId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/chats/${chatId}/mark_messages_read/`, {}).pipe(
      tap(() => {
        // Update the chat's unread count in the local state
        const currentChats = this.chatsSubject.value
        const updatedChats = currentChats.map((chat) => (chat.id === chatId ? { ...chat, unread_count: 0 } : chat))
        this.chatsSubject.next(updatedChats)

        // Emit the messages read event
        this.messagesReadSubject.next(chatId)
      }),
      catchError((error) => {
        console.error("Error marking messages as read:", error)
        return of(null)
      }),
    )
  }

  // Send a message with optional reply functionality
  sendMessage(chatId: string, text_content: string, replyToMessageId?: string): Observable<Message> {
    console.log(
      "Sending message from chat service:",
      text_content,
      replyToMessageId ? `replying to: ${replyToMessageId}` : "",
    )

    if (!text_content.trim()) {
      return of({} as Message)
    }

    // Create optimistic message with reply_to field if provided
    const optimisticMessage: Message = {
      id: "temp-" + new Date().getTime(),
      chat: chatId,
      text_content,
      message_type: "text",
      is_from_user: true,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
      status: "sent",
      status_updated_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      is_translated: false,
      reactions: [],
      user: undefined,
      content: undefined,
    }

    // Add reply_to if provided
    if (replyToMessageId) {
      optimisticMessage.reply_to = replyToMessageId
    }

    this.addMessageToList(optimisticMessage)
    this.updateChatWithLatestMessage(chatId, optimisticMessage)

    // Clear reply after sending
    this.setReplyToMessage(null)

    // Ensure WebSocket connection
    this.ensureWebSocketConnection(chatId, () => {
      // Pass the reply_to ID to the WebSocket service
      this.wsService.sendMessage(text_content, replyToMessageId)
    })

    return of(optimisticMessage)
  }

  // Ensure WebSocket connection
  private ensureWebSocketConnection(chatId: string, onConnected: () => void): void {
    if (this.wsService.isConnected()) {
      onConnected()
      return
    }

    this.wsService.connect(chatId)
    setTimeout(() => {
      if (this.wsService.isConnected()) {
        onConnected()
      } else {
        // Still try to send even if connection failed (will be queued)
        onConnected()
      }
    }, 500)
  }

  // Select a chat
  selectChat(chatId: string): void {
    // Handle empty chat ID (e.g., mobile view navigation)
    if (!chatId) {
      this.currentChatIdSubject.next(null)
      this.resetMessages()
      this.wsService.disconnect()
      return
    }

    if (this.currentChatIdSubject.value === chatId) {
      this.checkWebSocketConnection(chatId)
      return
    }

    // Disconnect from previous WebSocket
    this.wsService.disconnect()
    this.resetMessages()

    // Update the current chat ID first
    this.currentChatIdSubject.next(chatId)

    // Load messages for the selected chat
    this.loadMessages(chatId).subscribe({
      next: () => {
        this.wsService.connect(chatId)
        this.markMessagesAsRead(chatId).subscribe()
      },
      error: (error) => console.error("Error loading messages:", error),
    })
  }

  // Check WebSocket connection
  checkWebSocketConnection(chatId: string): void {
    if (!this.wsService.isConnected()) {
      this.wsService.connect(chatId)
    }
  }

  // Handle new messages from WebSocket
  private handleNewMessage(message: Message): void {
    if (!message || !message.id) {
      return
    }

    // Prevent duplicate messages
    if (this.messageDeduplicationCache.has(message.id)) {
      return
    }

    this.messageDeduplicationCache.add(message.id)
    const existingMessages = this.messagesSubject.value

    // For user messages, replace any matching temp message
    if (message.is_from_user) {
      const tempMessageIndex = existingMessages.findIndex(
        (msg) => msg.id?.startsWith("temp-") && msg.text_content === message.text_content && msg.is_from_user === true,
      )

      if (tempMessageIndex >= 0) {
        const updatedMessages = [...existingMessages]
        updatedMessages[tempMessageIndex] = message
        this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages))
      } else {
        this.addMessageToList(message)
      }
    } else {
      this.addMessageToList(message)
      if (message.id) {
        this.wsService.sendReadReceipt(message.id)
      }
    }

    // Update the chat list
    if (message.chat) {
      this.updateChatWithLatestMessage(message.chat, message)
    }
  }

  // Get a specific chat by ID
  getChat(chatId: string): Observable<Chat> {
    return this.http.get<Chat>(`${this.apiUrl}/chats/${chatId}/`).pipe(
      catchError((error) => {
        console.error("Error getting chat:", error)
        return of({} as Chat)
      }),
    )
  }

  // Add a message to the messages list
  private addMessageToList(message: Message): void {
    const currentMessages = this.messagesSubject.value

    // Check if message already exists
    const messageExists = currentMessages.some(
      (msg) =>
        msg.id === message.id ||
        (msg.id?.startsWith("temp-") &&
          msg.text_content === message.text_content &&
          msg.is_from_user === message.is_from_user),
    )

    if (!messageExists) {
      const updatedMessages = [...currentMessages, message] // Add to end for chronological order
      this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages))
    }
  }

  // Update a chat's last message in the list
  private updateChatWithLatestMessage(chatId: string, message: Message): void {
    const chats = this.chatsSubject.value
    const chatIndex = chats.findIndex((chat) => chat.id === chatId)

    if (chatIndex > -1) {
      const updatedChat = {
        ...chats[chatIndex],
        last_message: {
          id: message.id,
          text_content: message.text_content || "",
          message_type: message.message_type,
          created_at: message.created_at,
          is_from_user: message.is_from_user,
          is_delivered: message.is_delivered || false,
          is_read: message.is_read || false,
        },
        last_active: new Date().toISOString(),
      }

      // Put this chat at the top of the list
      const updatedChats = [updatedChat, ...chats.filter((chat) => chat.id !== chatId)]

      this.chatsSubject.next(updatedChats)
    }
  }

  // Sort messages by date (oldest first - for display)
  private sortMessagesByTimestamp(messages: Message[]): Message[] {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime()
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime()
      return timeA - timeB
    })
  }

  deleteMessage(chatId: string, messageId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/messages/${messageId}/`).pipe(
      tap(() => {
        // Remove message from local state
        const currentMessages = this.messagesSubject.value
        const updatedMessages = currentMessages.filter((msg) => msg.id !== messageId)
        this.messagesSubject.next(updatedMessages)

        // Remove from deduplication cache
        this.messageDeduplicationCache.delete(messageId)
      }),
      catchError((error) => {
        console.error("Error deleting message:", error)
        return of(null)
      }),
    )
  }

  // Reset messages state (e.g., when switching chats)
  resetMessages(): void {
    this.messagesSubject.next([])
    this.messageDeduplicationCache.clear()
  }

  /**
   * Saves a voice message and sends it to the specified chat
   * @param chatId - The ID of the chat where the message will be sent
   * @param audioBlob - The audio blob containing the recorded voice message
   * @param duration - The duration of the voice recording in seconds
   * @param format - The format of the audio (default: 'audio/webm')
   * @returns An Observable of the saved message
   */
  saveVoiceMessage(
    chatId: string,
    audioBlob: Blob,
    duration: number,
    replyToMessageId?: string,
    format: string = 'audio/webm'
  ): Observable<Message> {
    // Validate inputs
    if (!chatId) {
      console.error('Invalid chat ID provided to saveVoiceMessage');
      return throwError(() => new Error('Invalid chat ID'));
    }

    if (!audioBlob || !(audioBlob instanceof Blob)) {
      console.error('Invalid audio blob provided to saveVoiceMessage');
      return throwError(() => new Error('Invalid audio data'));
    }

    // Validate duration to ensure it's an integer
    const validDuration = Math.round(duration);

    // Create an optimistic message to improve UI responsiveness
    const optimisticMessage: Message = {
      id: 'temp-voice-' + new Date().getTime(),
      chat: chatId,
      text_content: '', // Empty for voice messages
      message_type: 'voice',
      is_from_user: true,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
      status: 'sending' as const,
      status_updated_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      is_translated: false,
      reactions: [],
      voice_note: '', // Placeholder for voice note ID
      user: undefined,
      content: undefined,
      reply_to: replyToMessageId ? replyToMessageId : undefined,
    };

    // Add optimistic message to UI
    this.addMessageToList(optimisticMessage);
    this.updateChatWithLatestMessage(chatId, optimisticMessage);

    // First upload the voice recording
    return this.uploadVoiceRecording(audioBlob, validDuration, format).pipe(
      switchMap((voiceRecording) => {
        if (!voiceRecording || !voiceRecording.id) {
          return throwError(
            () => new Error('Failed to upload voice recording')
          );
        }

        // Then create a message with the voice recording ID
        const messageData = {
          chat: chatId,
          message_type: 'voice',
          is_from_user: true,
          voice_note: voiceRecording.id,
          text_content: '', // Empty for voice messages
          duration_seconds: validDuration, // Use rounded integer
        };

        // Create the message using the message endpoint
        return this.http
          .post<Message>(`${this.apiUrl}/messages/`, messageData)
          .pipe(
            tap((message) => {
              // Find and replace the optimistic message with the real one
              const currentMessages = this.messagesSubject.value;
              const updatedMessages = currentMessages.map((msg) =>
                msg.id === optimisticMessage.id ? message : msg
              );

              // Update messages and add to deduplication cache
              if (message.id) {
                this.messageDeduplicationCache.add(message.id);
                this.messageDeduplicationCache.delete(optimisticMessage.id);
              }

              this.messagesSubject.next(
                this.sortMessagesByTimestamp(updatedMessages)
              );

              // Update chat with confirmed message
              this.updateChatWithLatestMessage(chatId, message);
            }),
            catchError((error) => {
              console.error('Error creating voice message:', error);

              // Mark the optimistic message as failed
              const currentMessages = this.messagesSubject.value;
              const updatedMessages = currentMessages.map((msg) => {
                if (msg.id === optimisticMessage.id) {
                  return { ...msg, status: 'error' as const };
                }
                return msg;
              });

              this.messagesSubject.next(updatedMessages);

              return throwError(
                () => new Error('Failed to send voice message')
              );
            })
          );
      }),
      catchError((error) => {
        console.error('Error in voice message upload process:', error);

        // Remove the optimistic message on failure
        const currentMessages = this.messagesSubject.value;
        const updatedMessages = currentMessages.filter(
          (msg) => msg.id !== optimisticMessage.id
        );
        this.messagesSubject.next(updatedMessages);

        // Return a more user-friendly error
        return throwError(
          () => new Error('Failed to send voice message. Please try again.')
        );
      })
    );
  }

  /**
   * Uploads a voice recording to the server
   * @param audioBlob - The audio blob to upload
   * @param duration - The duration in seconds
   * @param format - The audio format
   * @returns An Observable of the created voice recording
   */
  private uploadVoiceRecording(audioBlob: Blob, duration: number, format: string): Observable<any> {
    // Ensure duration is a positive integer
    const validDuration = Math.max(1, Math.round(duration))

    // Create form data for multipart/form-data upload
    const formData = new FormData()
    // Create a file from the blob with a timestamp filename
    const fileName = `voice_${new Date().getTime()}.webm`
    const audioFile = new File([audioBlob], fileName, { type: format })

    // Add the file and metadata to form data
    formData.append("audio_file", audioFile)
    formData.append("duration_seconds", validDuration.toString())
    formData.append("format", format)
    formData.append("sample_rate", "44100") // Default sample rate

    // Upload to the voice recordings endpoint
    return this.http.post<any>(`${this.apiUrl}/voice-recordings/`, formData).pipe(
      catchError((error) => {
        console.error("Voice recording upload failed:", error)
        return throwError(() => new Error("Failed to upload voice recording"))
      }),
    )
  }

  /**
   * Set the message to reply to
   */
  setReplyToMessage(message: Message | null): void {
    this.replyToMessageSubject.next(message)
  }

  /**
   * Get the current message being replied to
   */
  getReplyToMessage(): Message | null {
    return this.replyToMessageSubject.value
  }

  reportMessage({ reason, details }: { reason: string; details?: string }, messageId: string) {
    const payload = details ? { reason, details } : { reason }
    return this.http.post<any>(`${this.apiUrl}/messages/${messageId}/report/`, payload).pipe(
      catchError((error) => {
        console.error("Error reporting message:", error)
        return throwError(() => new Error("Failed to report message"))
      }),
    )
  }

  clearChat(chatId: string) {
    return this.http.delete(`${this.apiUrl}/chats/${chatId}/clear_chat/`)
  }

  muteChat(chatId: string, mute: boolean) {
    return this.http.patch(`${this.apiUrl}/chats/${chatId}/mute_chat/`, {
      muted: mute,
    })
  }

  blockContact(chatId: string) {
    return this.http.post(`${this.apiUrl}/chats/${chatId}/block_contact/`, {})
  }

  // Report a contact/chat
  reportContact(chatId: string, reportData: any) {
    return this.http.post(`${this.apiUrl}/chats/${chatId}/report_contact/`, {
      reason: reportData.reason,
      details: reportData.details,
    })
  }

  archiveChat(chatId: string) {
    return this.http.patch(`${this.apiUrl}/chats/${chatId}/toggle_archive/`, {}).pipe(
      tap((response: any) => {
        // Update the chat in the current list instead of removing it
        const currentChats = this.chatsSubject.value
        const updatedChats = currentChats.map((chat) =>
          chat.id === chatId ? { ...chat, is_archived: !chat.is_archived } : chat,
        )

        this.chatsSubject.next(updatedChats)

        // Emit the archived chat ID
        this.chatArchivedSubject.next(chatId)
      }),
      catchError((error) => {
        console.error("Error archiving chat:", error)
        return throwError(() => error)
      }),
    )
  }

  public chatArchived$ = this.chatArchivedSubject.asObservable().pipe(filter((chatId) => chatId !== null))

  /**
   * Gets detailed information about a specific chat
   * @param chatId - The ID of the chat to retrieve
   * @returns Observable with chat details including twin_id if it's a twin chat
   */
  getChatDetails(chatId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/chats/${chatId}/`).pipe(
      tap((chat) => {
        console.log("Chat details retrieved:", chat)
      }),
      catchError((error) => {
        console.error("Error getting chat details:", error)
        return of({ id: chatId }) // Return minimal object with ID on error
      }),
    )
  }

  /**
   * Sends a PDF file to a twin in a chat
   * @param chatId - The ID of the chat where the PDF will be sent
   * @param pdfBlob - The PDF blob to send
   * @param fileName - The name of the PDF file
   * @param twinId - The ID of the twin recipient
   * @param replyToMessageId - Optional ID of message being replied to
   * @returns Observable of the sent message
   */
  sendPdfToTwin(
    chatId: string,
    pdfBlob: Blob,
    fileName: string,
    twinId: string,
    replyToMessageId?: string,
  ): Observable<Message> {
    // Validate inputs
    if (!chatId || !twinId) {
      console.error("Invalid chat ID or twin ID provided to sendPdfToTwin")
      return throwError(() => new Error("Invalid chat or twin ID"))
    }

    if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.type !== "application/pdf") {
      console.error("Invalid PDF blob provided to sendPdfToTwin")
      return throwError(() => new Error("Invalid PDF file"))
    }

    // Create an optimistic message to improve UI responsiveness
    const optimisticMessage: Message = {
      id: "temp-pdf-" + new Date().getTime(),
      chat: chatId,
      text_content: `PDF: ${fileName}`, // Show filename in text content
      message_type: "file",
      is_from_user: true,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
      status: "sending" as const,
      status_updated_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      is_translated: false,
      reactions: [],
      file_attachment: {
        name: fileName,
        type: "application/pdf",
        size: pdfBlob.size,
        url: URL.createObjectURL(pdfBlob), // Temporary URL for display
      },
      user: undefined,
      content: undefined,
      reply_to: replyToMessageId ? replyToMessageId : undefined,
      twin_id: twinId, // Include twin ID in the message
    }

    // Add optimistic message to UI
    this.addMessageToList(optimisticMessage)
    this.updateChatWithLatestMessage(chatId, optimisticMessage)

    // Create form data for multipart/form-data upload
    const formData = new FormData()
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" })

    // Add the file and metadata to form data
    formData.append("file", pdfFile)
    formData.append("chat", chatId)
    formData.append("message_type", "file")
    formData.append("twin_id", twinId)
    console.log("Twin ID: ", twinId);


    if (replyToMessageId) {
      formData.append("reply_to", replyToMessageId)
    }

    // TODOs: end it to the server request(twin_id, file) and we will get a response (message) than we will save it in messages

    // Upload to the messages endpoint with file attachment
    return this.http.post<Message>(`${this.apiUrl}/messages/file/`, formData).pipe(
      tap((message) => {
        // Find and replace the optimistic message with the real one
        const currentMessages = this.messagesSubject.value
        const updatedMessages = currentMessages.map((msg) => (msg.id === optimisticMessage.id ? message : msg))

        // Update messages and add to deduplication cache
        if (message.id) {
          this.messageDeduplicationCache.add(message.id)
          this.messageDeduplicationCache.delete(optimisticMessage.id)
        }

        this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages))

        // Update chat with confirmed message
        this.updateChatWithLatestMessage(chatId, message)
      }),
      catchError((error) => {
        console.error("Error sending PDF to twin:", error)

        // Mark the optimistic message as failed
        const currentMessages = this.messagesSubject.value
        const updatedMessages = currentMessages.map((msg) => {
          if (msg.id === optimisticMessage.id) {
            return { ...msg, status: "error" as const }
          }
          return msg
        })

        this.messagesSubject.next(updatedMessages)

        return throwError(() => new Error("Failed to send PDF to twin"))
      }),
    )
  }

  /**
   * Sends a regular file message (not PDF to twin)
   * @param chatId - The ID of the chat where the file will be sent
   * @param fileBlob - The file blob to send
   * @param fileName - The name of the file
   * @param replyToMessageId - Optional ID of message being replied to
   * @returns Observable of the sent message
   */
  sendFileMessage(chatId: string, fileBlob: Blob, fileName: string, replyToMessageId?: string): Observable<Message> {
    // Validate inputs
    if (!chatId) {
      console.error("Invalid chat ID provided to sendFileMessage")
      return throwError(() => new Error("Invalid chat ID"))
    }

    if (!fileBlob || !(fileBlob instanceof Blob)) {
      console.error("Invalid file blob provided to sendFileMessage")
      return throwError(() => new Error("Invalid file"))
    }

    // Create an optimistic message to improve UI responsiveness
    const optimisticMessage: Message = {
      id: "temp-file-" + new Date().getTime(),
      chat: chatId,
      text_content: `File: ${fileName}`, // Show filename in text content
      message_type: "file",
      is_from_user: true,
      created_at: new Date().toISOString(),
      is_delivered: false,
      is_read: false,
      status: "sending" as const,
      status_updated_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      is_translated: false,
      reactions: [],
      file_attachment: {
        name: fileName,
        type: fileBlob.type,
        size: fileBlob.size,
        url: URL.createObjectURL(fileBlob), // Temporary URL for display
      },
      user: undefined,
      content: undefined,
      reply_to: replyToMessageId ? replyToMessageId : undefined,
    }

    // Add optimistic message to UI
    this.addMessageToList(optimisticMessage)
    this.updateChatWithLatestMessage(chatId, optimisticMessage)

    // Create form data for multipart/form-data upload
    const formData = new FormData()
    const file = new File([fileBlob], fileName, { type: fileBlob.type })

    // Add the file and metadata to form data
    formData.append("file", file)
    formData.append("chat", chatId)
    formData.append("message_type", "file")

    if (replyToMessageId) {
      formData.append("reply_to", replyToMessageId)
    }

    // Upload to the messages endpoint with file attachment
    return this.http.post<Message>(`${this.apiUrl}/messages/file/`, formData).pipe(
      tap((message) => {
        // Find and replace the optimistic message with the real one
        const currentMessages = this.messagesSubject.value
        const updatedMessages = currentMessages.map((msg) => (msg.id === optimisticMessage.id ? message : msg))

        // Update messages and add to deduplication cache
        if (message.id) {
          this.messageDeduplicationCache.add(message.id)
          this.messageDeduplicationCache.delete(optimisticMessage.id)
        }

        this.messagesSubject.next(this.sortMessagesByTimestamp(updatedMessages))

        // Update chat with confirmed message
        this.updateChatWithLatestMessage(chatId, message)
      }),
      catchError((error) => {
        console.error("Error sending file message:", error)

        // Mark the optimistic message as failed
        const currentMessages = this.messagesSubject.value
        const updatedMessages = currentMessages.map((msg) => {
          if (msg.id === optimisticMessage.id) {
            return { ...msg, status: "error" as const }
          }
          return msg
        })

        this.messagesSubject.next(updatedMessages)

        return throwError(() => new Error("Failed to send file message"))
      }),
    )
  }

  deleteChat(chatId: string) {
    // TODO: delete the chat from the chats list
    return this.http.delete(`${this.apiUrl}/chats/${chatId}/`).pipe(
      tap(() => {
        const currentChats = this.chatsSubject.value
        const updatedChats = currentChats.filter((chat) => chat.id !== chatId)
        this.chatsSubject.next(updatedChats)
      }),
    )
  }
}
