import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: 'danger' | 'warning' | 'info';
}

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 class="text-xl font-semibold mb-4 dark:text-white">{{ data.title }}</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-6">{{ data.message }}</p>
        <div class="flex justify-end space-x-4">
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            (click)="onCancel()"
          >
            {{ data.cancelText }}
          </button>
          <button
            [class]="getConfirmButtonClass()"
            (click)="onConfirm()"
          >
            {{ data.confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
    styles: []
})
export class ConfirmDialogComponent {
    constructor(@Inject('DIALOG_DATA') public data: ConfirmDialogData) { }

    getConfirmButtonClass(): string {
        const baseClass = 'px-4 py-2 rounded font-medium';
        switch (this.data.type) {
            case 'danger':
                return `${baseClass} bg-red-600 text-white hover:bg-red-700`;
            case 'warning':
                return `${baseClass} bg-yellow-600 text-white hover:bg-yellow-700`;
            default:
                return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`;
        }
    }

    onConfirm(): void {
        // This will be handled by the service
    }

    onCancel(): void {
        // This will be handled by the service
    }
}