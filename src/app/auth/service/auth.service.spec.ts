import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { throwError, from } from 'rxjs';


describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Verifies no outstanding HTTP requests
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call the login API and return tokens on success', () => {
    const mockResponse = {
      tokens: { access: 'access_token', refresh: 'refresh_token',  },
      user: {
        username: 'test_user',
        email: 'test@test.com',
        role: 'user',
        profile_image: 'http://localhost:8000/images/test.jpg',
      },
      message: 'Login successful',
    };

    service.login('test@test.com', 'password123@').subscribe((response: any) => {
      expect(response.tokens.access).toBe('access_token');
      expect(response.tokens.refresh).toBe('refresh_token');
      expect(response.user).toEqual({
        username: 'test_user',
        email: 'test@test.com',
        role: 'user',
        profile_image: 'http://localhost:8000/images/test.jpg',
      })
    });

    const req = httpMock.expectOne('http://127.0.0.1:8000/api/v1/auth/login/');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should handle errors correctly', () => {
    const mockError = { error: { detail: ['Invalid email or password.'] } };

    service.login('test@test.com', 'wrongPassword').subscribe({
      next: () => fail('Expected an error, but got a success response'),
      error: (error: any) => {
        // Safely access the first error in the detail array
        const errorMessage = error.error.error.detail[0];

        expect(errorMessage).toBe('Invalid email or password.');
      },
    });

    const req = httpMock.expectOne('http://127.0.0.1:8000/api/v1/auth/login/');
    expect(req.request.method).toBe('POST');

    // Correctly mock the error response with status 400 and statusText
    req.flush(mockError, { status: 400, statusText: 'Bad Request' });
  });

  it('should call the register API and return tokens on success', () => {
    const mockResponse = {
      tokens: { access: 'access_token', refresh: 'refresh_token' },
      user:{
        id: 1,
        username: 'test_user',
        email: 'test@test.com',
        profile_image: 'default.jpg',
      },
      message: 'Registration successful',
    };

    from(service.register({ email: 'test@test.com', password: 'password123@' })).subscribe((response: any) => {
      expect(response.tokens.access).toBe('access_token');
      expect(response.tokens.refresh).toBe('refresh_token');
      expect(response.user).toEqual({
        id: 1,
        username: 'test_user',
        email: 'test@test.com',
        profile_image: 'default.jpg',
      });
    });

    const req = httpMock.expectOne('http://127.0.0.1:8000/api/v1/auth/register/');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should remove tokens and call logout API on logout', () => {
    // Store tokens in storage before logging out
    sessionStorage.setItem('access_token', 'mock_access_token');
    localStorage.setItem('refresh_token', 'mock_refresh_token');

    service.logout().subscribe(response => {
      // Verify that tokens are removed from storage
      expect(sessionStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    const req = httpMock.expectOne('http://127.0.0.1:8000/api/v1/auth/logout/');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Logged out successfully' });
  });
});
// Removed incorrect implementation of from function

