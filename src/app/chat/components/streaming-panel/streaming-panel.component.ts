import { Component, Input, Output, EventEmitter, type OnInit, type OnDestroy } from "@angular/core"
import { Subject, takeUntil } from "rxjs"
import { StreamingConfig, StreamingService, StreamingSession } from "../../services/streaming.service"

@Component({
  selector: "app-streaming-panel",
  templateUrl: "./streaming-panel.component.html",
  styleUrls: ["./streaming-panel.component.scss"],
})
export class StreamingPanelComponent implements OnInit, OnDestroy {
  @Input() isVisible = false
  @Input() chatId: string | null = null
  @Output() close = new EventEmitter<void>()
  @Output() streamingEvent = new EventEmitter<any>()

  // Streaming state
  currentSession: StreamingSession | null = null
  isConnected = false
  avatarStatus = "idle"
  error: string | null = null
  isLoading = false

  // Configuration
  streamingConfig: StreamingConfig = {
    avatar_id: "anna_public_3_20240108",
    voice_id: "1bd001e7e50f421d891986aad5158bc8",
    language: "en",
    quality: "high",
  }

  // Available options
  avatarOptions = [
    { id: "anna_public_3_20240108", name: "Anna", description: "Professional female avatar" },
    { id: "josh_lite3_20230714", name: "Josh", description: "Casual male avatar" },
    { id: "eric_public_pro2_20230608", name: "Eric", description: "Business male avatar" },
  ]

  voiceOptions = [
    { id: "1bd001e7e50f421d891986aad5158bc8", name: "Anna Voice", language: "en" },
    { id: "2ed001e7e50f421d891986aad5158bc9", name: "Josh Voice", language: "en" },
    { id: "3fd001e7e50f421d891986aad5158bca", name: "Eric Voice", language: "en" },
  ]

  qualityOptions = [
    { value: "low", label: "Low (faster)" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High (better quality)" },
  ]

  // Text input
  textToSpeak = ""
  quickMessages = [
    "Hello! How can I help you today?",
    "Thank you for your message. Let me think about that.",
    "That's a great question. Here's what I think...",
    "I understand your concern. Let me explain.",
    "Is there anything else you'd like to know?",
  ]

  private destroy$ = new Subject<void>()

  constructor(private streamingService: StreamingService) {}

  ngOnInit(): void {
    // Subscribe to streaming service observables
    this.streamingService.currentSession$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
      this.currentSession = session
      this.emitStreamingEvent("session_update", { session })
    })

    this.streamingService.connectionStatus$.pipe(takeUntil(this.destroy$)).subscribe((connected) => {
      this.isConnected = connected
      this.emitStreamingEvent("connection_status", { connected })
    })

    this.streamingService.avatarStatus$.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.avatarStatus = status
      this.emitStreamingEvent("avatar_status", { status })
    })

    this.streamingService.error$.pipe(takeUntil(this.destroy$)).subscribe((error) => {
      this.error = error
      this.isLoading = false
      if (error) {
        this.emitStreamingEvent("error", { error })
      }
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  // Start streaming session
  startStreaming(): void {
    if (this.currentSession) {
      return
    }

    this.isLoading = true
    this.error = null

    this.streamingService.startStreaming(this.streamingConfig).subscribe({
      next: (session) => {
        console.log("Streaming started:", session)
        this.isLoading = false
        this.emitStreamingEvent("session_started", { session })
      },
      error: (error) => {
        console.error("Failed to start streaming:", error)
        this.isLoading = false
        this.error = "Failed to start streaming session"
      },
    })
  }

  // Stop streaming session
  stopStreaming(): void {
    if (!this.currentSession) {
      return
    }

    this.isLoading = true

    this.streamingService.stopStreaming().subscribe({
      next: (response) => {
        console.log("Streaming stopped:", response)
        this.isLoading = false
        this.emitStreamingEvent("session_ended", {})
      },
      error: (error) => {
        console.error("Failed to stop streaming:", error)
        this.isLoading = false
        this.error = "Failed to stop streaming session"
      },
    })
  }

  // Send text to avatar
  sendText(text?: string): void {
    const textToSend = text || this.textToSpeak
    if (!textToSend.trim() || !this.currentSession) {
      return
    }

    this.streamingService.sendText(textToSend).subscribe({
      next: (response) => {
        console.log("Text sent:", response)
        this.textToSpeak = ""
        this.emitStreamingEvent("message_sent", { text: textToSend })
      },
      error: (error) => {
        console.error("Failed to send text:", error)
        this.error = "Failed to send message to avatar"
      },
    })
  }

  // Send quick message
  sendQuickMessage(message: string): void {
    this.sendText(message)
  }

  // Update configuration
  updateConfig(field: keyof StreamingConfig, value: string): void {
    this.streamingConfig = {
      ...this.streamingConfig,
      [field]: value,
    }
  }

  // Close panel
  closePanel(): void {
    this.close.emit()
  }

  // Clear error
  clearError(): void {
    this.streamingService.clearError()
  }

  // Emit streaming events to parent
  private emitStreamingEvent(type: string, data: any = {}): void {
    this.streamingEvent.emit({
      type,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  // Get status display text
  getStatusText(): string {
    if (!this.isConnected) return "Disconnected"
    if (!this.currentSession) return "Not streaming"
    if (this.avatarStatus === "talking") return "Avatar speaking..."
    return "Ready"
  }

  // Get status color class
  getStatusColorClass(): string {
    if (!this.isConnected) return "text-red-500"
    if (!this.currentSession) return "text-gray-500"
    if (this.avatarStatus === "talking") return "text-blue-500"
    return "text-green-500"
  }
}
