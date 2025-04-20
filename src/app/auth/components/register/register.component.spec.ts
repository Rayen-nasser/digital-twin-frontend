import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../service/auth.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let toastrService: jasmine.SpyObj<ToastrService>;
  let authService: jasmine.SpyObj<AuthService>;
  let spinnerService: jasmine.SpyObj<NgxSpinnerService>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [RegisterComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    toastrService = jasmine.createSpyObj('ToastrService', ['success', 'error']);
    authService = jasmine.createSpyObj('AuthService', ['register']);
    spinnerService = jasmine.createSpyObj('NgxSpinnerService', ['show', 'hide']);

    TestBed.configureTestingModule({
      declarations: [RegisterComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ToastrService, useValue: toastrService },
        { provide: AuthService, useValue: authService },
        { provide: NgxSpinnerService, useValue: spinnerService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should submit form successfully with valid data', fakeAsync(() => {
    const formData = {
      username: 'TestUser',
      email: 'test@example.com',
      password: 'Password123',
      role: 'Student',
    };

    component.registerForm.setValue(formData);
    component.profilePicture = new File([''], 'profile.jpg', { type: 'image/jpeg' });
    spyOn(component, 'onSubmit').and.callThrough();

    authService.register.and.returnValue(of({}).toPromise());

    component.onSubmit();
    fixture.detectChanges();
    tick();  // Ensure async operations complete

    expect(toastrService.success).toHaveBeenCalledWith('Registration successful. Please log in.');
    expect(component.onSubmit).toHaveBeenCalled();
  }));

  it('should handle generic error on form submission failure', fakeAsync(() => {
    const formData = {
      username: 'TestUser',
      email: 'test@example.com',
      password: 'Password123',
      role: 'Student',
    };

    component.registerForm.setValue(formData);
    component.profilePicture = new File([''], 'profile.jpg', { type: 'image/jpeg' });

    // Simulate a rejected promise with a generic error
    const genericError = { error: null }; // Simulates a non-specific error
    authService.register.and.returnValue(Promise.reject(genericError));

    component.onSubmit();
    tick(); // Complete async operations

    // Assertions
    expect(spinnerService.show).toHaveBeenCalled();
    expect(spinnerService.hide).toHaveBeenCalled();
    expect(toastrService.error).toHaveBeenCalledWith(
      'Something went wrong. Please try again later.',
      'Registration Failed'
    );
  }));

  it('should show preview of the profile picture', fakeAsync(() => {
    // Create a mock File with actual content
    const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='; // Minimal valid JPEG content
    const byteCharacters = atob(base64Image.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });

    // Mock FileReader
    const mockFileReader: FileReader = {
      readAsDataURL: function(blob: Blob) {
        setTimeout(() => {
          this.result = base64Image;
          this.onload?.(new ProgressEvent('load'));
        }, 50);
      },
      result: null,
      onload: null,
    } as any;

    spyOn(window, 'FileReader').and.returnValue(mockFileReader);

    // Trigger file change event
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileChange(event);

    // Wait for FileReader to complete
    tick(50);
    fixture.detectChanges();

    // Verify the preview is set
    expect(component.profilePicturePreview).toBe(base64Image);

    // Verify the image element shows the preview
    const imgElement = fixture.debugElement.query(By.css('img'));
    expect(imgElement.nativeElement.src).toBe(base64Image);
  }));

  it('should show error when form is invalid and submitted', () => {
    component.registerForm.controls['username'].setValue('');
    component.registerForm.controls['email'].setValue('');
    component.registerForm.controls['password'].setValue('');
    component.registerForm.controls['role'].setValue('');

    // Ensure profile picture is not set for this test
    component.profilePicture = null;

    component.onSubmit();

    expect(toastrService.error).toHaveBeenCalledWith('Please fill in all required fields.', 'Validation Error');

  });

});
