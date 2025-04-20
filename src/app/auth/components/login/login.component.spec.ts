import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../service/auth.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { ToastrModule } from 'ngx-toastr';  // Import ToastrModule for providing the necessary configuration
import { By } from '@angular/platform-browser';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let spinnerServiceSpy: jasmine.SpyObj<NgxSpinnerService>;
  let toastrServiceSpy: jasmine.SpyObj<ToastrService>;

  beforeEach(() => {
    const toastrSpy = jasmine.createSpyObj('ToastrService', ['success', 'error']);
    const authServiceMock = jasmine.createSpyObj('AuthService', ['login']);
    const routerMock = jasmine.createSpyObj('Router', ['navigate']);
    const spinnerServiceMock = jasmine.createSpyObj('NgxSpinnerService', ['show', 'hide']);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ToastrModule.forRoot()],  // Add ToastrModule
      declarations: [LoginComponent],
      providers: [
        FormBuilder,
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: NgxSpinnerService, useValue: spinnerServiceMock },
        { provide: ToastrService, useValue: toastrSpy }
      ]
    });

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    spinnerServiceSpy = TestBed.inject(NgxSpinnerService) as jasmine.SpyObj<NgxSpinnerService>;
    toastrServiceSpy = TestBed.inject(ToastrService) as jasmine.SpyObj<ToastrService>;

    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should call login() method on valid form submission', () => {
    // Arrange
    component.loginForm.setValue({ email: 'test@example.com', password: 'password123' });
    authServiceSpy.login.and.returnValue(of({ message: 'Success' }));

    // Act
    component.onSubmit();

    // Assert
    expect(authServiceSpy.login).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(toastrServiceSpy.success).toHaveBeenCalledWith('Login successful!', 'Success');
  });

  it('should display error toast on failed login', () => {
    // Arrange
    component.loginForm.setValue({ email: 'test@example.com', password: 'password123' });
    authServiceSpy.login.and.returnValue(throwError(() => new Error('Login failed')));

    // Act
    component.onSubmit();

    // Assert
    expect(toastrServiceSpy.error).toHaveBeenCalledWith('Something went wrong. Please try again later.', 'Login Failed');
  });

  it('should show spinner during login attempt', () => {
    // Arrange
    component.loginForm.setValue({ email: 'test@example.com', password: 'password123' });
    authServiceSpy.login.and.returnValue(of({ message: 'Success' }));

    // Act
    component.onSubmit();

    // Assert
    expect(spinnerServiceSpy.show).toHaveBeenCalled();
    expect(spinnerServiceSpy.hide).toHaveBeenCalled();
  });

  // it('should show error message for invalid form data', () => {
  //   component.loginForm.controls['email'].setValue('');
  //   component.loginForm.controls['password'].setValue('');

  //   component.onSubmit();

  //   fixture.detectChanges();

  //   const errorMessage = fixture.debugElement.query(By.css('.error-message'));
  //   expect(errorMessage).toBeTruthy();
  // });

});
