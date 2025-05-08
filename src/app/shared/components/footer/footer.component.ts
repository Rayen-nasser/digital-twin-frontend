import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedService } from '../../service/shared.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  newsletterForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private shredService: SharedService,
    private toasterService: ToastrService
  ) {
    this.newsletterForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubscribe() {
    if (this.newsletterForm.valid) {
      this.shredService.addSubscribe(this.newsletterForm.value.email).subscribe((res:any) =>{
        this.newsletterForm.reset();
        this.toasterService.success('Subscribed successfully');
      });
    }
  }
}
