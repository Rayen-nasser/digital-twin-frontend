import { Injectable, ComponentRef, createComponent, ApplicationRef, Injector, Type } from '@angular/core';
import { Subject } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({
    providedIn: 'root'
})
export class DialogService {
    private dialogComponentRef: ComponentRef<any> | null = null;

    constructor(
        private appRef: ApplicationRef,
        private injector: Injector
    ) { }

    openConfirmDialog(data: ConfirmDialogData): Subject<boolean> {
        const result = new Subject<boolean>();

        // Create component
        const componentRef = createComponent(ConfirmDialogComponent, {
            environmentInjector: this.appRef.injector,
            elementInjector: Injector.create({
                providers: [
                    { provide: 'DIALOG_DATA', useValue: data }
                ],
                parent: this.injector
            })
        });

        // Add to DOM
        document.body.appendChild(componentRef.location.nativeElement);
        this.appRef.attachView(componentRef.hostView);
        this.dialogComponentRef = componentRef;

        // Handle confirm/cancel
        const originalOnConfirm = componentRef.instance.onConfirm;
        const originalOnCancel = componentRef.instance.onCancel;

        componentRef.instance.onConfirm = () => {
            this.closeDialog();
            result.next(true);
            result.complete();
        };

        componentRef.instance.onCancel = () => {
            this.closeDialog();
            result.next(false);
            result.complete();
        };

        return result;
    }

    private closeDialog(): void {
        if (this.dialogComponentRef) {
            this.appRef.detachView(this.dialogComponentRef.hostView);
            this.dialogComponentRef.destroy();
            this.dialogComponentRef = null;
        }
    }
}