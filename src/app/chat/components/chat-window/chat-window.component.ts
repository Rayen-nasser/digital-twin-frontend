
import type { Message } from "../../models/message.model"
import type { Chat } from "../../models/chat.model"
import { Subject, type Subscription, takeUntil, debounceTime } from "rxjs"
import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from "@angular/core"
import { ChatService } from "../../services/chat.service"
import { WebsocketService } from "../../services/websocket.service"
import { ThemeService } from "../../../core/services/theme.service"
import { ToastrService } from "ngx-toastr"

@Component({
  selector: "app-chat-window",
  templateUrl: "./chat-window.component.html",
  styleUrls: ["./chat-window.component.scss"],
})
export class ChatWindowComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() messages: Message[] | null = []
  @Input() currentChatId: string | null = null
  @ViewChild("messagesContainer") private messagesContainer?: ElementRef

  // Add this Output property at the top of the class with the other properties
  @Output() reportMessageEvent = new EventEmitter<string>()

  // Properties
  isDarkMode = false
  currentChat: Chat | null = null
  displayMessages: Message[] = []
  isTyping = false
  isLoadingOlderMessages = false
  hasMoreMessages = true
  showOptions = false
  isNearBottom = true
  nextCursor: string | null = null

  // New properties for dropdown menu functionality
  isMuted = false
  showSearchOverlay = false
  searchQuery = ""
  searchResults: Message[] = []

  // Private properties
  private destroy$ = new Subject<void>()
  private themeSubscription: Subscription | null = null
  private initialMessagesLoaded = false
  private messageIds = new Set<string>()
  private scrollLocked = false
  private scrollEvents = new Subject<Event>()
  private lastScrollTop = 0
  private scrollToBottomOnNextRender = false

  constructor(
    private chatService: ChatService,
    private wsService: WebsocketService,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
    private ngZone: NgZone,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.initializeTheme()
    this.setupScrollHandler()
    this.connectWebsocket()
    this.setupWebsocketListeners()
    this.subscribeToChatMessages()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["currentChatId"] && this.currentChatId) {
      this.resetChatState()
      this.loadChatDetails()
      this.connectWebsocket()
      this.loadInitialMessages()
    }

    if (changes["messages"] && this.messages && this.messages.length > 0) {
      this.processIncomingMessages(this.messages)
    }
  }

  ngAfterViewChecked(): void {
    if (this.scrollToBottomOnNextRender) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.scrollToBottom()
          this.scrollToBottomOnNextRender = false
        }, 0)
      })
    }
  }

  ngOnDestroy(): void {
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe()
    }
    this.destroy$.next()
    this.destroy$.complete()
  }

  // Public methods
  onScroll(event: Event): void {
    this.scrollEvents.next(event)
    this.checkIfNearBottom(event)
  }

  encodeURI(url: string): string {
    return window.encodeURI(url)
  }

  scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        const element = this.messagesContainer.nativeElement
        element.scrollTop = element.scrollHeight
        this.lastScrollTop = element.scrollTop
        this.isNearBottom = true
      } catch (err) {
        console.error("Error scrolling to bottom:", err)
      }
    }
  }

  groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
    if (!messages || messages.length === 0) return []

    const grouped: { [key: string]: Message[] } = {}

    messages.forEach((message) => {
      const dateStr = message.created_at || message.timestamp
      if (!dateStr) return

      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return

      const dateKey = date.toLocaleDateString()
      grouped[dateKey] = grouped[dateKey] || []
      grouped[dateKey].push(message)
    })

    return Object.keys(grouped)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({
        date,
        messages: grouped[date].sort((a, b) => {
          const timeA = new Date(a.created_at || a.timestamp || 0).getTime()
          const timeB = new Date(b.created_at || b.timestamp || 0).getTime()
          return timeA - timeB
        }),
      }))
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Unknown Date"

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
  }

  formatLastSeen(dateString?: string): string {
    if (!dateString) return "a while ago"

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "a while ago"

    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSeconds < 60) return "just now"
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`
    if (diffSeconds < 86400)
      return `${Math.floor(diffSeconds / 3600)} hour${Math.floor(diffSeconds / 3600) > 1 ? "s" : ""} ago`

    return date.toLocaleDateString()
  }

  formatMessageTime(dateString?: string): string {
    if (!dateString) return ""

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  onTypingStarted(isTyping: boolean): void {
    this.wsService.sendTypingIndicator(isTyping)
  }

  toggleOptions(): void {
    this.showOptions = !this.showOptions
  }

  showChatList(): void {
    this.chatService.selectChat("")
  }

  loadOlderMessages(): void {
    if (!this.currentChatId || this.isLoadingOlderMessages || !this.hasMoreMessages || !this.nextCursor) return

    this.isLoadingOlderMessages = true
    this.scrollLocked = true
    const previousHeight = this.messagesContainer?.nativeElement.scrollHeight || 0
    const previousScrollTop = this.messagesContainer?.nativeElement.scrollTop || 0

    this.chatService.getMessagesByCursor(this.currentChatId, this.nextCursor).subscribe({
      next: (response) => {
        if (!response || !response.results) {
          this.isLoadingOlderMessages = false
          this.scrollLocked = false
          return
        }

        // Filter out any messages we've already seen
        const newMessages = response.results
          .filter((msg: any) => !this.messageIds.has(msg.id))
          .map((msg: any) => this.ensureMessageDates(msg))

        // Add to message ID set
        newMessages.forEach((msg: any) => {
          if (msg.id) this.messageIds.add(msg.id)
        })

        // Only update display messages if we have new unique messages
        if (newMessages.length > 0) {
          this.displayMessages = [...newMessages, ...this.displayMessages]
          this.sortMessages()
        }

        // Update cursor for next page
        this.nextCursor = response.next ? this.extractCursor(response.next) : null
        this.hasMoreMessages = !!this.nextCursor

        // Maintain scroll position after loading more messages
        setTimeout(() => {
          if (this.messagesContainer) {
            const newHeight = this.messagesContainer.nativeElement.scrollHeight
            const heightDiff = newHeight - previousHeight
            this.messagesContainer.nativeElement.scrollTop = previousScrollTop + heightDiff
          }
          this.isLoadingOlderMessages = false
          this.scrollLocked = false
          this.cdr.detectChanges()
        }, 100)
      },
      error: (error) => {
        console.error("Error loading older messages:", error)
        this.isLoadingOlderMessages = false
        this.scrollLocked = false
      },
    })
  }

  // New methods for dropdown menu functionality
  searchConversation(): void {
    this.showOptions = false
    this.showSearchOverlay = true
    this.searchQuery = ""
    this.searchResults = []
  }

  closeSearch(): void {
    this.showSearchOverlay = false
    this.searchQuery = ""
    this.searchResults = []
  }

  onSearchInput(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = []
      return
    }

    const query = this.searchQuery.toLowerCase()
    this.searchResults = this.displayMessages.filter(
      (message) => message.text_content && message.text_content.toLowerCase().includes(query),
    )
  }

  scrollToMessage(messageId: string): void {
    this.closeSearch()

    // Find the message element and scroll to it
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${messageId}`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: "smooth", block: "center" })
        // Highlight the message temporarily
        messageElement.classList.add("bg-yellow-100", "dark:bg-yellow-900")
        setTimeout(() => {
          messageElement.classList.remove("bg-yellow-100", "dark:bg-yellow-900")
        }, 2000)
      }
    }, 100)
  }

  clearChat(): void {
    if (!this.currentChatId) return

    if (confirm("Are you sure you want to clear all messages? This action cannot be undone.")) {
      this.chatService.clearChat(this.currentChatId).subscribe({
        next: () => {
          this.displayMessages = []
          this.messageIds.clear()
          this.toastr.success("Chat cleared successfully")
          this.showOptions = false
        },
        error: (error: any) => {
          console.error("Error clearing chat:", error)
          this.toastr.error("Failed to clear chat")
        },
      })
    }
  }

  toggleMuteNotifications(): void {
    if (!this.currentChatId) return

    this.isMuted = !this.isMuted
    this.chatService.muteChat(this.currentChatId, this.isMuted).subscribe({
      next: () => {
        this.toastr.success(this.isMuted ? "Notifications muted" : "Notifications unmuted")
        this.showOptions = false
      },
      error: (error) => {
        console.error("Error toggling mute status:", error)
        this.isMuted = !this.isMuted // Revert on error
        this.toastr.error("Failed to update notification settings")
      },
    })
  }

  blockContact(): void {
    if (!this.currentChatId || !this.currentChat) return

    if (
      confirm(
        `Are you sure you want to block ${this.currentChat.twin_details?.twin_name}? You won't receive messages from them anymore.`,
      )
    ) {
      this.chatService.blockContact(this.currentChatId).subscribe({
        next: () => {
          this.toastr.success("Contact blocked")
          this.showOptions = false
          // Navigate back to chat list
          this.showChatList()
        },
        error: (error) => {
          console.error("Error blocking contact:", error)
          this.toastr.error("Failed to block contact")
        },
      })
    }
  }

  reportContact(): void {
    if (!this.currentChatId || !this.currentChat) return

    // Close the options menu
    this.showOptions = false

    // You can implement a more sophisticated report flow here
    // Emit an event to the parent component to show the report modal for contact
    this.reportMessageEvent.emit(`contact:${this.currentChatId}`)
  }

archiveConversation() {
  if (!this.currentChatId || !this.currentChat) return

  this.chatService.archiveChat(this.currentChatId).subscribe({
    next: () => {
      this.toastr.success("Conversation archived")
      this.showOptions = false
      // No need to manually emit - the service does it automatically
    },
    error: (error) => {
      console.error("Error archiving conversation:", error);
      this.toastr.error("Failed to archive conversation")
    },
  })
}


  // Message action handler
  handleMessageAction(actionData: { action: string; messageId: string; reportData?: any }): void {
    console.log("Action received:", actionData)

    switch (actionData.action) {
      case "delete":
        console.log("Deleting message:", actionData.messageId)
        this.deleteMessage(actionData.messageId)
        break
      case "report":
        console.log("Reporting message from window chat:", actionData.messageId)
        this.reportMessage(actionData.messageId)
        break
    }
  }

  // Implementation of the action methods:
  deleteMessage(messageId: string): void {
    if (this.currentChatId) {
      this.chatService
        .deleteMessage(this.currentChatId, messageId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Remove message from display messages
            this.displayMessages = this.displayMessages.filter((msg) => msg.id !== messageId)
            this.cdr.detectChanges()
          },
          error: (error) => console.error("Error deleting message:", error),
        })
    }
  }

  reportMessage(messageId: string): void {
    // Emit an event to the parent (dashboard) component to show the report modal
    console.log("Emitting reportMessageEvent with messageId:", messageId)
    this.reportMessageEvent.emit(messageId)
  }

  // Private methods
  private initializeTheme(): void {
    this.isDarkMode = this.themeService.getCurrentTheme() === "dark"
    this.themeSubscription = this.themeService.theme$.subscribe((theme) => {
      this.isDarkMode = theme === "dark"
      this.cdr.detectChanges()
    })
  }

  private setupScrollHandler(): void {
    this.scrollEvents
      .pipe(takeUntil(this.destroy$), debounceTime(200))
      .subscribe((event) => this.handleScrollEvent(event))
  }

  private connectWebsocket(): void {
    if (this.currentChatId && !this.wsService.isConnected()) {
      this.wsService.connect(this.currentChatId)
    }
  }

  private setupWebsocketListeners(): void {
    // Handle read receipts
    this.wsService
      .messages()
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        if (message.type === "read_receipt" && message["message_ids"]) {
          message["message_ids"].forEach((id: string) => {
            const msgIndex = this.displayMessages.findIndex((m) => m.id === id)
            if (msgIndex >= 0) {
              this.displayMessages[msgIndex].is_read = true
              this.displayMessages[msgIndex].status = "read"
            }
          })
          this.cdr.detectChanges()
        }
      })

    // Handle typing indicators
    this.wsService
      .typingIndicator()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isTyping) => {
        this.isTyping = isTyping
        if (this.isTyping && this.isNearBottom) {
          this.scrollToBottomOnNextRender = true
          this.cdr.detectChanges()
        }
      })

    // Handle new messages
    this.wsService
      .newMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        if (!message) return

        this.ensureMessageDates(message)
        const existingIndex = this.displayMessages.findIndex((m) => m.id === message.id)

        if (existingIndex >= 0) {
          this.displayMessages[existingIndex] = { ...message }
        } else if (message.is_from_user) {
          const tempIndex = this.displayMessages.findIndex(
            (m) => m.id?.startsWith("temp-") && m.text_content === message.text_content,
          )

          if (tempIndex >= 0) {
            this.displayMessages[tempIndex] = { ...message }
          } else {
            this.displayMessages = [...this.displayMessages, message]
          }
        } else {
          this.displayMessages = [...this.displayMessages, message]
          if (this.isNearBottom) {
            this.scrollToBottomOnNextRender = true
          }
        }

        this.sortMessages()
        this.cdr.detectChanges()
      })
  }

  private subscribeToChatMessages(): void {
    this.chatService.messages$.pipe(takeUntil(this.destroy$)).subscribe((messages) => {
      if (messages && messages.length > 0) {
        this.processIncomingMessages(messages)
      }
    })
  }

  private processIncomingMessages(messages: Message[]): void {
    const processedMessages = messages.map((msg) => this.ensureMessageDates(msg))

    processedMessages.forEach((msg) => {
      if (msg.id) this.messageIds.add(msg.id)
    })

    this.displayMessages = processedMessages
    this.sortMessages()

    if (!this.initialMessagesLoaded && this.displayMessages.length > 0) {
      this.initialMessagesLoaded = true
      this.scrollToBottomOnNextRender = true
    }

    this.cdr.detectChanges()
  }

  private resetChatState(): void {
    this.initialMessagesLoaded = false
    this.hasMoreMessages = true
    this.nextCursor = null
    this.messageIds.clear()
    this.displayMessages = []
    this.showOptions = false
    this.showSearchOverlay = false
    this.isMuted = false
  }

  private loadChatDetails(): void {
    if (!this.currentChatId) return

    this.chatService.getChat(this.currentChatId).subscribe({
      next: (chat: any) => {
        this.currentChat = chat
        // Check if chat is muted
        this.isMuted = chat.is_muted || false
        this.cdr.detectChanges()
      },
      error: (error) => console.error("Error loading chat details:", error),
    })
  }

  private loadInitialMessages(): void {
    if (!this.currentChatId) return

    this.chatService.getMessages(this.currentChatId, 30).subscribe({
      next: (response) => {
        if (response && response.results) {
          const processedMessages = response.results.map((msg: any) => this.ensureMessageDates(msg))

          processedMessages.forEach((msg: any) => {
            if (msg.id) this.messageIds.add(msg.id)
          })

          this.displayMessages = processedMessages
          this.sortMessages()

          this.nextCursor = response.next ? this.extractCursor(response.next) : null
          this.hasMoreMessages = !!this.nextCursor

          this.initialMessagesLoaded = true
          this.scrollToBottomOnNextRender = true
          this.cdr.detectChanges()
        }
      },
      error: (error) => console.error("Error loading initial messages:", error),
    })
  }

  private ensureMessageDates(message: Message): Message {
    const now = new Date().toISOString()

    if (!message.created_at || isNaN(new Date(message.created_at).getTime())) {
      message.created_at = message.timestamp || now
    }

    if (!message.timestamp || isNaN(new Date(message.timestamp).getTime())) {
      message.timestamp = message.created_at || now
    }

    return message
  }

  private sortMessages(): void {
    this.displayMessages.sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp || 0).getTime()
      const timeB = new Date(b.created_at || b.timestamp || 0).getTime()
      return timeA - timeB
    })
  }

  private checkIfNearBottom(event: Event): void {
    const element = event.target as HTMLElement
    const threshold = 100 // pixels from bottom to consider "near bottom"

    this.isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold
  }

  private handleScrollEvent(event: Event): void {
    if (this.scrollLocked) return

    const element = event.target as HTMLElement

    // Check if we're near the top and scrolling upward
    if (
      element.scrollTop < 150 &&
      element.scrollTop < this.lastScrollTop &&
      this.hasMoreMessages &&
      !this.isLoadingOlderMessages &&
      this.nextCursor
    ) {
      this.loadOlderMessages()
    }

    this.lastScrollTop = element.scrollTop
  }

  private extractCursor(nextUrl: string): string | null {
    try {
      const url = new URL(nextUrl)
      return url.searchParams.get("cursor")
    } catch (e) {
      console.error("Invalid URL format for cursor", nextUrl)
      return null
    }
  }
}
