// footer.component.spec.ts
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { FooterComponent } from './footer.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FooterComponent],
      imports: [
        ReactiveFormsModule,
        RouterTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the newsletter form', () => {
    expect(component.newsletterForm).toBeDefined();
    expect(component.newsletterForm.get('email')).toBeDefined();
  });

  it('should have the current year in the copyright notice', () => {
    const currentYear = new Date().getFullYear();
    const footerElement: HTMLElement = fixture.nativeElement;
    expect(footerElement.textContent).toContain(currentYear.toString());
  });

  it('should validate email format', () => {
    const emailControl = component.newsletterForm.get('email');

    emailControl?.setValue('');
    expect(emailControl?.valid).toBeFalsy();
    expect(emailControl?.errors?.['required']).toBeTruthy();

    emailControl?.setValue('invalid-email');
    expect(emailControl?.valid).toBeFalsy();
    expect(emailControl?.errors?.['email']).toBeTruthy();

    emailControl?.setValue('valid@email.com');
    expect(emailControl?.valid).toBeTruthy();
  });

  it('should handle form submission', fakeAsync(() => {
    spyOn(console, 'log');
    spyOn(component.newsletterForm, 'reset');

    const emailControl = component.newsletterForm.get('email');
    emailControl?.setValue('test@example.com');

    component.onSubscribe();
    tick();

    expect(console.log).toHaveBeenCalledWith('Subscribe:', { email: 'test@example.com' });
    expect(component.newsletterForm.reset).toHaveBeenCalled();
  }));

  it('should not submit form with invalid email', fakeAsync(() => {
    spyOn(console, 'log');
    spyOn(component.newsletterForm, 'reset');

    const emailControl = component.newsletterForm.get('email');
    emailControl?.setValue('invalid-email');

    component.onSubscribe();
    tick();

    expect(console.log).not.toHaveBeenCalled();
    expect(component.newsletterForm.reset).not.toHaveBeenCalled();
  }));

  it('should render all footer sections', () => {
    const footerElement: HTMLElement = fixture.nativeElement;

    // Company Info
    expect(footerElement.querySelector('h3')?.textContent).toContain('E-Learn');

    // Quick Links
    expect(footerElement.textContent).toContain('Quick Links');
    expect(footerElement.textContent).toContain('About Us');
    expect(footerElement.textContent).toContain('Our Courses');

    // Support
    expect(footerElement.textContent).toContain('Support');
    expect(footerElement.textContent).toContain('Help Center');
    expect(footerElement.textContent).toContain('FAQs');

    // Newsletter
    expect(footerElement.textContent).toContain('Newsletter');
    const emailInput = footerElement.querySelector('input[type="email"]');
    expect(emailInput).toBeTruthy();
  });

  it('should render social media links', () => {
    const socialLinks = fixture.nativeElement.querySelectorAll('.fab');
    expect(socialLinks.length).toBeGreaterThan(0);
  });

  it('should render contact information', () => {
    const footerElement: HTMLElement = fixture.nativeElement;
    expect(footerElement.textContent).toContain('support@elearn.com');
    expect(footerElement.textContent).toContain('+1 (555) 123-4567');
  });
});
