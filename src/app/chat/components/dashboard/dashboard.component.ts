// Enhanced dashboard.component.ts with PDF twin functionality
import { Component, type OnInit, type OnDestroy, HostListener, ViewChild } from "@angular/core"
import { isPlatformBrowser } from "@angular/common"
import { type Observable, Subject, takeUntil } from "rxjs"
import type { Chat } from "../../models/chat.model"
import type { Message } from "../../models/message.model"
import type { User } from "../../models/user.interface"
import { ChatService } from "../../services/chat.service"
import { WebsocketService } from "../../services/websocket.service"
import { AuthService } from "../../../auth/service/auth.service"
import { ToastrService } from "ngx-toastr"

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild("heygenStreaming") heygenStreamingComponent: any

  chats$: Observable<Chat[]>
  messages$: Observable<Message[]>
  currentChatId$: Observable<string | null>
  user$: Observable<User | null>
  reportType!: "message" | "contact"

  isWebSocketConnected = false
  mobileView = false
  screenWidth = 0
  sidebarOpen = false
  settingsMenuOpen = false

  // Report modal properties
  showReportModal = false
  reportingMessageId = ""

  // HeyGen streaming properties
  showStreamingPanel = false
  isStreamingActive = false
  selectedChatIdForContactReport = ""

  // Twin chat properties
  currentChatIsTwin = false
  currentTwinId = ""

  private destroy$ = new Subject<void>()
  private platformId: Object

  constructor(
    private chatService: ChatService,
    private wsService: WebsocketService,
    private authService: AuthService,
    toasterService: ToastrService,
  ) {
    this.platformId = window
    this.chats$ = this.chatService.chats$
    this.messages$ = this.chatService.messages$
    this.currentChatId$ = this.chatService.currentChatId$
    this.user$ = this.authService.user$
    this.toasterService = toasterService
  }

  @HostListener("window:resize", ["$event"])
  onResize() {
    this.checkScreenSize()
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.screenWidth = window.innerWidth
      this.mobileView = this.screenWidth < 1024
    }
  }

  ngOnInit(): void {
    this.checkScreenSize()
    this.chatService.loadChats().subscribe()
    this.authService.getUserProfile().pipe(takeUntil(this.destroy$)).subscribe()

    // Monitor WebSocket connection status
    this.wsService
      .connectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        console.log("Dashboard - WebSocket connection status:", connected)
        this.isWebSocketConnected = connected
      })

    // Monitor current chat for twin detection
    this.currentChatId$.pipe(takeUntil(this.destroy$)).subscribe((chatId) => {
      if (chatId) {
        this.checkIfTwinChat(chatId)
      } else {
        this.currentChatIsTwin = false
        this.currentTwinId = ""
      }
    })
  }

  // Check if current chat is with a twin
  private checkIfTwinChat(chatId: string): void {
    this.chatService
      .getChatDetails(chatId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((chat) => {
        // Assuming chat object has twin_id property when it's a twin chat
        this.currentChatIsTwin = !!chat.twin_id
        this.currentTwinId = chat.twin_id || ""
        console.log("Twin chat detected:", this.currentChatIsTwin, "Twin ID:", this.currentTwinId)
      })
  }

  // Enhanced chat selection with streaming preparation
  onChatSelected(chatId: string): void {
    this.chatService.selectChat(chatId)

    // Close sidebar on mobile after selecting a chat
    if (this.mobileView) {
      this.sidebarOpen = false
    }
  }

  // Enhanced message sending with PDF twin support
  onSendMessage(payload: any): void {
    this.currentChatId$.pipe(takeUntil(this.destroy$)).subscribe((currentChatId: string | null) => {
      if (currentChatId) {
        // Send text message
        if (payload.text) {
          this.chatService.sendMessage(currentChatId, payload.text, payload.replyToMessageId).subscribe({
            next: (response) => {
              console.log("Message sent:", response)
            },
            error: (error) => console.error("Error sending message:", error),
          })
        }
        // Handle voice/audio messages
        else if (payload.attachment && payload.attachment.type === "audio") {
          this.fetchAudioBlob(payload.attachment.url).then((audioBlob) => {
            if (audioBlob) {
              this.chatService
                .saveVoiceMessage(
                  currentChatId,
                  audioBlob,
                  payload.attachment.duration || 0,
                  payload.attachment.format || "audio/webm",
                  payload.replyToMessageId,
                )
                .subscribe({
                  next: (response) => console.log("Voice message sent successfully", response),
                  error: (error) => console.error("Error sending voice message:", error),
                })
            }
          })
        }
        // Handle PDF messages to twins
        else if (payload.attachment && payload.attachment.type === "pdf") {
          console.log("Sending PDF to twin:", payload.attachment.twin_id);
          if (this.currentChatIsTwin ) {

            this.fetchFileBlob(payload.attachment.url).then((pdfBlob) => {
              if (pdfBlob) {
                this.chatService
                  .sendPdfToTwin(
                    currentChatId,
                    pdfBlob,
                    payload.attachment.name,
                    this.currentTwinId,
                    payload.replyToMessageId,
                  )
                  .subscribe({
                    next: (response) => {
                      console.log("PDF sent to twin successfully", response)
                      this.toasterService.success("PDF sent to twin successfully")
                    },
                    error: (error) => {
                      console.error("Error sending PDF to twin:", error)
                      this.toasterService.error("Failed to send PDF to twin")
                    },
                  })
              }
            })
          } else {
            console.warn("PDF can only be sent to twin chats")
            this.toasterService.warning("PDF files can only be sent to twin chats")
          }
        }
        // Handle regular file attachments
        else if (payload.attachment && payload.attachment.type === "file") {
          this.fetchFileBlob(payload.attachment.url).then((fileBlob) => {
            if (fileBlob) {
              this.chatService
                .sendFileMessage(currentChatId, fileBlob, payload.attachment.name, payload.replyToMessageId)
                .subscribe({
                  next: (response) => console.log("File sent successfully", response),
                  error: (error) => console.error("Error sending file:", error),
                })
            }
          })
        }
      }
    })
  }

  // Generate content from chat and stream
  generateAndStreamFromChat(): void {
    this.currentChatId$.pipe(takeUntil(this.destroy$)).subscribe((chatId) => {
      if (chatId) {
        if (this.heygenStreamingComponent) {
          this.heygenStreamingComponent.generateAndStream()
        }
      }
    })
  }

  // Handle streaming events from the component
  onStreamingEvent(event: any): void {
    switch (event.type) {
      case "session_started":
        this.toasterService.success("AI Avatar streaming session started")
        break
      case "session_ended":
        this.toasterService.info("AI Avatar streaming session ended")
        break
      case "message_sent":
        console.log("Message sent to streaming:", event.data)
        break
      case "error":
        this.toasterService.error(`Streaming error: ${event.message}`)
        break
      default:
        console.log("Streaming event:", event)
    }
  }

  createNewChat(): void {
    console.log("Creating new chat")
    // Implementation for creating new chat
  }

  private fetchAudioBlob(blobUrl: string | Blob): Promise<Blob | null> {
    if (blobUrl instanceof Blob) {
      return Promise.resolve(blobUrl)
    }

    if (blobUrl.startsWith("data:")) {
      try {
        const base64 = blobUrl.split(",")[1]
        const binary = atob(base64)
        const len = binary.length
        const buffer = new ArrayBuffer(len)
        const view = new Uint8Array(buffer)

        for (let i = 0; i < len; i++) {
          view[i] = binary.charCodeAt(i)
        }

        const contentType = blobUrl.split(";")[0].split(":")[1] || "audio/webm"
        return Promise.resolve(new Blob([buffer], { type: contentType }))
      } catch (e) {
        console.error("Error converting data URL to Blob:", e)
        return Promise.resolve(null)
      }
    }

    if (blobUrl.startsWith("blob:")) {
      return fetch(blobUrl)
        .then((response) => response.blob())
        .catch((error) => {
          console.error("Error fetching blob from URL:", error)
          return null
        })
    }

    console.error("Invalid URL format:", blobUrl)
    return Promise.resolve(null)
  }

  // NEW: Helper method to fetch file blobs (including PDFs)
  private fetchFileBlob(blobUrl: string | Blob): Promise<Blob | null> {
    if (blobUrl instanceof Blob) {
      return Promise.resolve(blobUrl)
    }

    if (blobUrl.startsWith("data:")) {
      try {
        const base64 = blobUrl.split(",")[1]
        const binary = atob(base64)
        const len = binary.length
        const buffer = new ArrayBuffer(len)
        const view = new Uint8Array(buffer)

        for (let i = 0; i < len; i++) {
          view[i] = binary.charCodeAt(i)
        }

        const contentType = blobUrl.split(";")[0].split(":")[1] || "application/octet-stream"
        return Promise.resolve(new Blob([buffer], { type: contentType }))
      } catch (e) {
        console.error("Error converting data URL to Blob:", e)
        return Promise.resolve(null)
      }
    }

    if (blobUrl.startsWith("blob:")) {
      return fetch(blobUrl)
        .then((response) => response.blob())
        .catch((error) => {
          console.error("Error fetching blob from URL:", error)
          return null
        })
    }

    console.error("Invalid URL format:", blobUrl)
    return Promise.resolve(null)
  }

  showChatList(): void {
    this.chatService.selectChat("")
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpen = !this.settingsMenuOpen
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpen = false
  }

  goBack() {
    window.history.back()
  }

  // Report modal methods
  openReportModal(messageIdOrSpecial: string): void {
    // Check if this is a contact report (format: "contact:chatId")
    if (messageIdOrSpecial.startsWith("contact:")) {
      const chatId = messageIdOrSpecial.split(":")[1]
      this.openReportContactModal(chatId)
    } else {
      // Regular message report
      console.log("Opening report modal for message ID:", messageIdOrSpecial)
      this.reportingMessageId = messageIdOrSpecial
      this.reportType = "message"
      this.showReportModal = true
    }
  }

  closeReportModal(): void {
    this.showReportModal = false
    this.reportingMessageId = ""
    this.reportType = "message"
    this.selectedChatIdForContactReport = ""
  }

  openReportContactModal(chatId: string): void {
    console.log("Opening report modal for contact with chat ID:", chatId)
    this.selectedChatIdForContactReport = chatId
    this.reportType = "contact"
    this.showReportModal = true
  }

  handleMessageAction(action: string): void {
    if (action === "report") {
      // Handle report action
      if (this.reportType === "message") {
        console.log("Reporting message with ID:", this.reportingMessageId)
        // Implement your reporting logic here for messages
      } else if (this.reportType === "contact") {
        console.log("Reporting contact with chat ID:", this.selectedChatIdForContactReport)
        // Implement your reporting logic here for contacts
      }
      this.closeReportModal()
    } else if (action === "cancel") {
      // Handle cancel action
      this.closeReportModal()
    }
  }

  // Update the onSubmitReport method to use the new reportContactWithReason method
  onSubmitReport(reportData: any): void {
    if (this.reportType === "message") {
      // Report a message
      this.chatService.reportMessage(reportData, this.reportingMessageId).subscribe({
        next: (response) => {
          this.toasterService.success("Message reported successfully")
          this.closeReportModal()
        },
        error: (error) => {
          console.error("Error reporting message:", error)
          this.toasterService.error("Failed to report message")
        },
      })
    } else if (this.reportType === "contact") {
      // Report a contact/chat
      this.chatService.reportContact(this.selectedChatIdForContactReport, reportData).subscribe({
        next: (response) => {
          this.toasterService.success("Contact reported successfully")
          this.closeReportModal()
        },
        error: (error) => {
          console.error("Error reporting contact:", error)
          this.toasterService.error("Failed to report contact")
        },
      })
    }
  }

  ngOnDestroy(): void {
    // Clean up websocket connection
    this.wsService.disconnect()

    // Complete all subscriptions
    this.destroy$.next()
    this.destroy$.complete()
  }

  private toasterService: ToastrService
}
