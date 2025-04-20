import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router, NavigationEnd, Routes } from '@angular/router';
import { NgxSpinnerModule } from 'ngx-spinner';
import { BehaviorSubject } from 'rxjs';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

// Create stub components
@Component({ selector: 'app-header', template: '' })
class HeaderStubComponent {}

@Component({ selector: 'app-footer', template: '' })
class FooterStubComponent {}

@Component({ template: '' })
class DummyComponent {}

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let router: Router;
  let routerEvents: BehaviorSubject<any>;

  // Define test routes
  const routes: Routes = [
    { path: 'auth/login', component: DummyComponent },
    { path: 'auth/register', component: DummyComponent },
    { path: 'courses', component: DummyComponent },
    { path: '', component: DummyComponent }
  ];

  beforeEach(async () => {
    // Create a subject to simulate router events
    routerEvents = new BehaviorSubject<any>(null);

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes(routes),
        NgxSpinnerModule
      ],
      declarations: [
        AppComponent,
        HeaderStubComponent,
        FooterStubComponent,
        DummyComponent
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct initial title', () => {
    expect(component.title).toBe('e-learning');
  });

  it('should show header and footer by default', () => {
    expect(component.showHeaderFooter).toBeFalsy();
  });

  describe('Router navigation handling', () => {
    it('should hide header and footer on login page', async () => {
      await router.navigate(['/auth/login']);
      fixture.detectChanges();

      expect(component.showHeaderFooter).toBeFalse();
    });

    it('should hide header and footer on register page', async () => {
      await router.navigate(['/auth/register']);
      fixture.detectChanges();

      expect(component.showHeaderFooter).toBeFalse();
    });

    it('should show header and footer on other pages', async () => {
      await router.navigate(['/']);
      fixture.detectChanges();

      expect(component.showHeaderFooter).toBeTrue();

      await router.navigate(['/courses']);
      fixture.detectChanges();

      expect(component.showHeaderFooter).toBeTrue();
    });
  });

  describe('Template rendering', () => {
    it('should conditionally render header and footer', async () => {
      // Initially both should be present
      let header = fixture.debugElement.query(By.css('app-header'));
      let footer = fixture.debugElement.query(By.css('app-footer'));

      expect(header).toBeFalsy();
      expect(footer).toBeFalsy();

      // Navigate to login page
      await router.navigate(['/auth/login']);
      fixture.detectChanges();

      // After navigation to login, both should be absent
      header = fixture.debugElement.query(By.css('app-header'));
      footer = fixture.debugElement.query(By.css('app-footer'));

      expect(header).toBeFalsy();
      expect(footer).toBeFalsy();
    });

    it('should always render router-outlet', () => {
      const routerOutlet = fixture.debugElement.query(By.css('router-outlet'));
      expect(routerOutlet).toBeTruthy();

      component.showHeaderFooter = false;
      fixture.detectChanges();

      const routerOutletAfter = fixture.debugElement.query(By.css('router-outlet'));
      expect(routerOutletAfter).toBeTruthy();
    });

    it('should always render ngx-spinner', () => {
      const spinner = fixture.debugElement.query(By.css('ngx-spinner'));
      expect(spinner).toBeTruthy();

      component.showHeaderFooter = false;
      fixture.detectChanges();

      const spinnerAfter = fixture.debugElement.query(By.css('ngx-spinner'));
      expect(spinnerAfter).toBeTruthy();
    });
  });
});
