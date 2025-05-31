import { Injectable } from "@angular/core"
import { HttpClient } from "@angular/common/http"
import { BehaviorSubject, Observable } from "rxjs"
import { io, type Socket } from "socket.io-client"

export interface StreamingSession {
  sessionId: string
  livekit_url: string
  livekit_token: string
  session_id: string
  isConnected: boolean
  status: "idle" | "connecting" | "connected" | "talking" | "error"
}

export interface StreamingConfig {
  avatar_id: string
  voice_id: string
  language?: string
  quality?: string
}

@Injectable({
  providedIn: "root",
})
export class StreamingService {
  private apiUrl = "http://localhost:3001/api/streaming"
  private socketUrl = "http://localhost:3001"
  private socket: Socket | null = null

  // State management
  private currentSessionSubject = new BehaviorSubject<StreamingSession | null>(null)
  private connectionStatusSubject = new BehaviorSubject<boolean>(false)
  private avatarStatusSubject = new BehaviorSubject<string>("idle")
  private errorSubject = new BehaviorSubject<string | null>(null)

  // Public observables
  public currentSession$ = this.currentSessionSubject.asObservable()
  public connectionStatus$ = this.connectionStatusSubject.asObservable()
  public avatarStatus$ = this.avatarStatusSubject.asObservable()
  public error$ = this.errorSubject.asObservable()

  constructor(private http: HttpClient) {
    this.initializeSocket()
  }

  private initializeSocket(): void {
    this.socket = io(this.socketUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    })

    this.socket.on("connect", () => {
      console.log("Connected to streaming server")
      this.connectionStatusSubject.next(true)
      this.errorSubject.next(null)
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from streaming server")
      this.connectionStatusSubject.next(false)
    })

    this.socket.on("session_status", (data: any) => {
      console.log("Session status update:", data)
      const currentSession = this.currentSessionSubject.value
      if (currentSession) {
        this.currentSessionSubject.next({
          ...currentSession,
          isConnected: data.connected,
        })
      }
    })

    this.socket.on("avatar_status", (data: any) => {
      console.log("Avatar status update:", data)
      this.avatarStatusSubject.next(data.status)
    })

    this.socket.on("stream_status", (data: any) => {
      console.log("Stream status update:", data)
    })

    this.socket.on("stream_error", (data: any) => {
      console.error("Stream error:", data)
      this.errorSubject.next(data.error)
    })

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      this.errorSubject.next("Failed to connect to streaming server")
    })
  }

  // Start a new streaming session
  startStreaming(config: StreamingConfig, initialText?: string): Observable<StreamingSession> {
    return new Observable((observer) => {
      const payload = {
        avatar_id: config.avatar_id,
        voice_id: config.voice_id,
        language: config.language || "en",
        quality: config.quality || "high",
        text: initialText,
      }

      this.http.post<any>(`${this.apiUrl}/start`, payload).subscribe({
        next: (response) => {
          if (response.success) {
            const session: StreamingSession = {
              sessionId: response.sessionId,
              livekit_url: response.livekit_url,
              livekit_token: response.livekit_token,
              session_id: response.session_id,
              isConnected: true,
              status: "connected",
            }

            this.currentSessionSubject.next(session)

            // Connect socket and join session room
            if (!this.socket?.connected) {
              this.socket?.connect()
            }

            this.socket?.emit("join_session", session.sessionId)

            observer.next(session)
            observer.complete()
          } else {
            observer.error(new Error(response.error || "Failed to start streaming"))
          }
        },
        error: (error) => {
          console.error("Error starting streaming:", error)
          this.errorSubject.next("Failed to start streaming session")
          observer.error(error)
        },
      })
    })
  }

  // Send text to the avatar
  sendText(text: string): Observable<any> {
    const currentSession = this.currentSessionSubject.value
    if (!currentSession) {
      return new Observable((observer) => {
        observer.error(new Error("No active streaming session"))
      })
    }

    const payload = {
      sessionId: currentSession.sessionId,
      text: text,
    }

    return this.http.post<any>(`${this.apiUrl}/speak`, payload)
  }

  // Stop the current streaming session
  stopStreaming(): Observable<any> {
    const currentSession = this.currentSessionSubject.value
    if (!currentSession) {
      return new Observable((observer) => {
        observer.next({ success: true, message: "No active session to stop" })
        observer.complete()
      })
    }

    const payload = {
      sessionId: currentSession.sessionId,
    }

    return new Observable((observer) => {
      this.http.post<any>(`${this.apiUrl}/stop`, payload).subscribe({
        next: (response) => {
          // Leave session room and disconnect socket
          this.socket?.emit("leave_session", currentSession.sessionId)
          this.socket?.disconnect()

          // Reset state
          this.currentSessionSubject.next(null)
          this.avatarStatusSubject.next("idle")
          this.connectionStatusSubject.next(false)
          this.errorSubject.next(null)

          observer.next(response)
          observer.complete()
        },
        error: (error) => {
          console.error("Error stopping streaming:", error)
          observer.error(error)
        },
      })
    })
  }

  // Get active sessions
  getActiveSessions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sessions`)
  }

  // Check if there's an active session
  hasActiveSession(): boolean {
    return this.currentSessionSubject.value !== null
  }

  // Get current session
  getCurrentSession(): StreamingSession | null {
    return this.currentSessionSubject.value
  }

  // Clear error
  clearError(): void {
    this.errorSubject.next(null)
  }

  // Cleanup on service destroy
  ngOnDestroy(): void {
    if (this.hasActiveSession()) {
      this.stopStreaming().subscribe()
    }
    this.socket?.disconnect()
  }
}
