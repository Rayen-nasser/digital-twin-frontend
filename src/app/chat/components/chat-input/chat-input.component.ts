import {
  Component,
  Output,
  EventEmitter,
  type ElementRef,
  ViewChild,
  type AfterViewInit,
  Input,
  type OnDestroy,
  HostListener,
  type OnInit,
} from "@angular/core"
import type { Observable, Subscription } from "rxjs"
import type { Message } from "../../models/message.model"
import { WebsocketService } from "../../services/websocket.service"
import { ThemeService } from "../../../core/services/theme.service"
import { ChatService } from "../../services/chat.service"

interface Attachment {
  type: "image" | "audio" | "file" | "pdf"
  name: string
  url: string
  size?: number
  isPlaying?: boolean
  duration?: any
  twin_id?: string // Added for PDF twin functionality
}

@Component({
  selector: "app-chat-input",
  templateUrl: "./chat-input.component.html",
  styleUrls: ["./chat-input.component.scss"],
})
export class ChatInputComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() sendMessage = new EventEmitter<{ text?: string; attachment?: Attachment; replyToMessageId?: string }>()
  @Output() typingStatus = new EventEmitter<boolean>()
  @ViewChild("messageInput") messageInput!: ElementRef<HTMLTextAreaElement>
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>
  @ViewChild("pdfInput") pdfInput!: ElementRef<HTMLInputElement> // Added for PDF input
  @Input() isConnected = false
  @Input() currentChatId = "" // Added to track current chat
  @Input() isTwinChat = false // Added to identify twin chats
  @Input() twinId = "" // Added to store twin ID

  message = ""
  showEmojiPicker = false
  typingTimeout: ReturnType<typeof setTimeout> | null = null
  theme$: Observable<"light" | "dark">

  // Mobile responsiveness
  showCompactUI = false
  showActionMenu = false
  screenWidth = 0

  // Recording state
  isRecording = false
  recordingTime = 0
  recordingInterval: ReturnType<typeof setInterval> | null = null

  // Media recorder
  private mediaRecorder!: MediaRecorder
  private audioChunks: Blob[] = []
  private mediaStream: MediaStream | null = null

  // Audio playback
  private audioPlayer: HTMLAudioElement | null = null

  // Attachments
  attachments: Attachment[] = []

  // Reply functionality
  replyToMessage: Message | null = null
  private replySubscription: Subscription | null = null

  // Emoji categories with type definition
  emojiCategories: { [key: string]: string[] } = {
    Smileys: ["😊", "😂", "🥹", "😍", "🥰", "😎", "🤩", "😇"],
    Gestures: ["👍", "👏", "👋", "🙌", "🤝", "👆", "✌️", "🫶"],
    Symbols: ["❤️", "🔥", "⭐", "🎉", "✨", "💯", "🙏", "💪"],
  }
  activeEmojiCategory = "Smileys"

  constructor(
    private wsService: WebsocketService,
    private themeService: ThemeService,
    private chatService: ChatService,
  ) {
    this.theme$ = this.themeService.theme$
  }

  ngOnInit(): void {
    this.checkScreenSize()
    window.addEventListener("resize", this.checkScreenSize.bind(this))

    // Subscribe to reply message changes
    this.replySubscription = this.chatService.replyToMessage$.subscribe((message) => {
      this.replyToMessage = message

      console.log("Replying to message:", this.replyToMessage)

      // Focus on the input field when a reply is set
      if (message && this.messageInput) {
        setTimeout(() => {
          this.messageInput.nativeElement.focus()
        })
      }
    })
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus()
        this.adjustTextareaHeight()
      }
    })
  }

  ngOnDestroy(): void {
    this.stopRecording()
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval)
    }
    // Clean up media resources
    this.closeMediaStream()
    // Stop any playing audio
    this.stopAllAudio()
    // Remove resize listener
    window.removeEventListener("resize", this.checkScreenSize.bind(this))
    // Clean up reply subscription
    if (this.replySubscription) {
      this.replySubscription.unsubscribe()
    }
  }

  // Cancel the current reply
  cancelReply(): void {
    this.replyToMessage = null
    // Also notify the service to clear the reply
    if (this.chatService) {
      this.chatService.setReplyToMessage(null)
    }
  }

  // Check screen size for responsive UI
  checkScreenSize(): void {
    this.screenWidth = window.innerWidth
    this.showCompactUI = this.screenWidth < 640 // sm breakpoint in Tailwind
  }

  // Toggle action menu for mobile
  toggleActionMenu(): void {
    this.showActionMenu = !this.showActionMenu
    // Always close emoji picker when action menu is toggled
    this.showEmojiPicker = false
  }

  // Handle clicks outside emoji picker to close it
  @HostListener("document:click", ["$event"])
  handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement
    if (this.showEmojiPicker && !target.closest(".emoji-container") && !target.closest(".emoji-button")) {
      this.showEmojiPicker = false
    }

    // Close action menu when clicking outside
    if (this.showActionMenu && !target.closest(".action-menu") && !target.closest('[aria-label="Show actions"]')) {
      this.showActionMenu = false
    }
  }

  // Adjust textarea height based on content
  adjustTextareaHeight(): void {
    const textarea = this.messageInput.nativeElement
    textarea.style.height = "auto"
    // Different max height for mobile
    const maxHeight = this.showCompactUI ? 80 : 120
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px"
  }

  onSendMessage(): void {
    const trimmedMessage = this.message.trim()
    if (trimmedMessage || this.attachments.length > 0) {
      // Send text message with reply info if present
      if (trimmedMessage) {
        this.sendMessage.emit({
          text: trimmedMessage,
          replyToMessageId: this.replyToMessage?.id,
        })
      }

      // Send attachments
      for (const attachment of this.attachments) {
        this.sendMessage.emit({
          attachment: attachment,
          replyToMessageId: this.replyToMessage?.id,
        })
      }

      // Stop any playing audio before clearing
      this.stopAllAudio()

      // Clear state
      this.message = ""
      this.attachments = []
      this.wsService.sendTypingIndicator(false)
      this.typingStatus.emit(false)

      // Clear reply after sending
      this.cancelReply()

      // Reset textarea height
      if (this.messageInput) {
        this.messageInput.nativeElement.style.height = "auto"
      }

      setTimeout(() => {
        if (this.messageInput) {
          this.messageInput.nativeElement.focus()
        }
      })
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    // Cancel reply on Escape key
    if (event.key === "Escape" && this.replyToMessage) {
      event.preventDefault()
      this.cancelReply()
      return
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.onSendMessage()
    } else {
      this.wsService.sendTypingIndicator(true)
      this.typingStatus.emit(true)

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout)
      }

      this.typingTimeout = setTimeout(() => {
        this.wsService.sendTypingIndicator(false)
        this.typingStatus.emit(false)
      }, 1500)
    }
  }

  onMessageChange(): void {
    this.adjustTextareaHeight()
  }

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation()
    this.showEmojiPicker = !this.showEmojiPicker
    // Close action menu when emoji picker is opened
    if (this.showEmojiPicker) {
      this.showActionMenu = false
    }
  }

  setEmojiCategory(category: string): void {
    this.activeEmojiCategory = category
  }

  addEmoji(emoji: string): void {
    this.message += emoji
    this.showEmojiPicker = false
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus()
        this.adjustTextareaHeight()
      }
    })
  }

  // Start audio recording
  startRecording(): void {
    this.isRecording = true
    this.recordingTime = 0

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaStream = stream
        this.mediaRecorder = new MediaRecorder(stream)
        this.audioChunks = []

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data)
        }

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" })
          const audioUrl = URL.createObjectURL(audioBlob)

          this.attachments.push({
            type: "audio",
            name: `Voice Message (${this.formatRecordingTime(this.recordingTime)})`,
            url: audioUrl,
            duration: this.recordingTime,
            isPlaying: false,
          })
          // Clean up media stream
          this.closeMediaStream()
        }

        this.mediaRecorder.start()

        // Start recording timer
        this.recordingInterval = setInterval(() => {
          this.recordingTime++
        }, 1000)
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err)
        this.isRecording = false
      })
  }

  // Stop audio recording
  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false
      this.mediaRecorder.stop()

      if (this.recordingInterval) {
        clearInterval(this.recordingInterval)
        this.recordingInterval = null
      }
    }
  }

  // Format recording time as MM:SS
  formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Handle regular file attachment
  onAttachmentClick(): void {
    this.fileInput.nativeElement.click()
  }

  // NEW: Handle PDF attachment for twin chats
  onPdfAttachmentClick(): void {
    if (!this.isTwinChat) {
      console.warn("PDF uploads are only available for twin chats")
      return
    }
    this.pdfInput.nativeElement.click()
  }

  // Modified file selection handler
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files)

      files.forEach((file) => {
        const fileType = file.type.startsWith("image/") ? "image" : "file"
        const reader = new FileReader()

        reader.onload = () => {
          this.attachments.push({
            type: fileType,
            name: file.name,
            size: file.size,
            url: reader.result as string,
          })
        }

        reader.readAsDataURL(file)
      })

      // Reset input so the same file can be selected again
      input.value = ""
    }
  }

  // NEW: Handle PDF file selection for twin chats
  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files)

      files.forEach((file) => {
        // Validate that it's a PDF file
        if (file.type !== "application/pdf") {
          console.warn("Only PDF files are allowed for twin chats")
          return
        }

        const reader = new FileReader()

        reader.onload = () => {
          this.attachments.push({
            type: "pdf",
            name: file.name,
            size: file.size,
            url: reader.result as string,
            twin_id: this.twinId, // Include twin_id in the attachment
          })
        }

        reader.readAsDataURL(file)
      })

      // Reset input so the same file can be selected again
      input.value = ""
    }
  }

  removeAttachment(index: number): void {
    // Stop audio if it's playing
    if (this.attachments[index].type === "audio" && this.attachments[index].isPlaying) {
      this.stopAllAudio()
    }
    this.attachments.splice(index, 1)
  }

  // Toggle audio playback
  toggleAudioPlayback(index: number): void {
    const audioAttachment = this.attachments[index]

    // First stop any currently playing audio
    this.stopAllAudio()

    // Then play the selected audio if it wasn't already playing
    if (!audioAttachment.isPlaying) {
      this.audioPlayer = new Audio(audioAttachment.url)
      audioAttachment.isPlaying = true

      this.audioPlayer.play()

      // Handle playback ended
      this.audioPlayer.onended = () => {
        audioAttachment.isPlaying = false
      }
    }
  }

  // Stop all audio playback
  stopAllAudio(): void {
    // Stop audio player if exists
    if (this.audioPlayer) {
      this.audioPlayer.pause()
      this.audioPlayer = null
    }

    // Reset isPlaying flags
    this.attachments.forEach((attachment) => {
      if (attachment.type === "audio") {
        attachment.isPlaying = false
      }
    })
  }

  // Clean up media stream resources
  private closeMediaStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
  }
}
