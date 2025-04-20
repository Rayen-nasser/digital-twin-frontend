import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [RouterModule.forRoot([])], // Import RouterModule
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the menu open state', () => {
    expect(component.isMenuOpen).toBeFalse();
    component.toggleMenu();
    expect(component.isMenuOpen).toBeTrue();
  });

  it('should toggle the profile dropdown', () => {
    expect(component.isProfileDropdownOpen).toBeFalse();
    component.toggleProfileDropdown(new MouseEvent('click'));
    expect(component.isProfileDropdownOpen).toBeTrue();
  });

  it('should toggle notifications dropdown', () => {
    expect(component.isNotificationsOpen).toBeFalse();
    component.toggleNotifications(new MouseEvent('click'));
    expect(component.isNotificationsOpen).toBeTrue();
  });

  it('should detect scrolling and update `isScrolled`', () => {
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(50);
    window.dispatchEvent(new Event('scroll'));
    expect(component.isScrolled).toBeTrue();
  });

  it('should close dropdowns when clicking outside', () => {
    component.isProfileDropdownOpen = true;
    component.isNotificationsOpen = true;

    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const mockElement = document.createElement('div');
    mockElement.className = 'outside-element';
    document.body.appendChild(mockElement);

    Object.defineProperty(event, 'target', { value: mockElement });

    window.dispatchEvent(event);

    expect(component.isProfileDropdownOpen).toBeFalse();
    expect(component.isNotificationsOpen).toBeFalse();

    document.body.removeChild(mockElement);
  });
});
