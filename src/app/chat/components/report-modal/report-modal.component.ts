// Update the ReportModalComponent to handle both message and contact reporting
import { Component, Input, Output, EventEmitter } from "@angular/core"

export interface ReportData {
  messageId?: string
  chatId?: string
  reason: string
  details: string
  reportType: "message" | "contact"
}

@Component({
  selector: "app-report-modal",
  templateUrl: "./report-modal.component.html",
  styleUrls: ["./report-modal.component.scss"],
})
export class ReportModalComponent {
  @Input() messageId = ""
  @Input() chatId = ""
  @Input() reportType: "message" | "contact" = "message"
  @Output() closeModal = new EventEmitter<void>()
  @Output() submitReport = new EventEmitter<ReportData>()

  reason = ""
  details = ""

  // Report reason options for both message and contact reports
  reportReasons = this.reportType === "message"
    ? [
        { value: "offensive", label: "Offensive Language" },
        { value: "spam", label: "Spam" },
        { value: "harassment", label: "Harassment" },
        { value: "inappropriate_behavior", label: "Inappropriate Behavior" },
        { value: "other", label: "Other" }
      ]
    : [
        { value: "inappropriate_behavior", label: "Inappropriate Behavior" },
        { value: "spam", label: "Spam" },
        { value: "harassment", label: "Harassment" },
        { value: "other", label: "Other" }
      ]

  get modalTitle(): string {
    return this.reportType === "message" ? "Report Message" : "Report Contact"
  }

  close(): void {
    this.closeModal.emit()
  }

  submit(): void {
    if (!this.reason) {
      alert("Please select a reason for reporting")
      return
    }

    this.submitReport.emit({
      messageId: this.reportType === "message" ? this.messageId : undefined,
      chatId: this.reportType === "contact" ? this.chatId : undefined,
      reason: this.reason,
      details: this.details,
      reportType: this.reportType,
    })

    // Reset form after submission
    this.reason = ""
    this.details = ""
    this.close()
  }
}
