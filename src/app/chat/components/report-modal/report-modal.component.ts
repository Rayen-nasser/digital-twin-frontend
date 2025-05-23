import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface ReportData {
  messageId: string;
  reason: string;
  details: string;
}

@Component({
  selector: 'app-report-modal',
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.scss']
})
export class ReportModalComponent {
  @Input() messageId: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() submitReport = new EventEmitter<ReportData>();

  reason: string = '';
  details: string = '';

  // Report reason options
  reportReasons = [
    { value: 'inappropriate', label: 'Inappropriate Content' },
    { value: 'offensive', label: 'Offensive Language' },
    { value: 'harmful', label: 'Harmful or Dangerous' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' }
  ];

  close(): void {
    this.closeModal.emit();
  }

  submit(): void {
    if (!this.reason) {
      alert('Please select a reason for reporting');
      return;
    }

    this.submitReport.emit({
      messageId: this.messageId,
      reason: this.reason,
      details: this.details
    });

    // Reset form after submission
    this.reason = '';
    this.details = '';
    this.close();
  }
}
