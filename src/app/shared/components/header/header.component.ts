// header.component.ts
import {
  Component,
  OnInit,
  HostListener,
  ViewChild,
  ElementRef,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../auth/service/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { User } from '../../../interfaces/user.interface';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false;
  user: User | null = null;
  showDropdown: boolean = false;
  showMobileMenu: boolean = false;
  isHomePage: boolean = false;
  activeSection: string = '';
  isScrolled: boolean = false;
  isDarkMode: boolean = false;
  private scrollThreshold: number = 10;

  private routerSubscription?: Subscription;
  private authSubscription?: Subscription;
  private themeSubscription?: Subscription;

  @ViewChild('profileDropdown') profileDropdown!: ElementRef;

  constructor(
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn()
    this.isDarkMode = this.themeService.isDarkMode();

    this.themeSubscription = this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.detectChanges();
    });

    this.isHomePage = this.router.url === '/' || this.router.url.startsWith('/#');

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isHomePage = event.url === '/' || event.url.startsWith('/#');
        this.showMobileMenu = false;
        this.showDropdown = false;

        if (this.isHomePage && event.url.includes('#')) {
          this.activeSection = event.url.split('#')[1];
        } else {
          this.activeSection = '';
        }
        this.cdr.detectChanges();
      });

    this.isScrolled = window.scrollY > this.scrollThreshold;

    if (this.isHomePage) {
      this.checkActiveSection();
    }

    // get user profile from localstorage
    const userProfile = localStorage.getItem('user_profile');
    this.user = userProfile ? JSON.parse(userProfile) : null;
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.authSubscription?.unsubscribe();
    this.themeSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (this.showDropdown && this.profileDropdown && !this.profileDropdown.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > this.scrollThreshold;
    if (this.isHomePage) {
      this.checkActiveSection();
    }
  }

  checkActiveSection(): void {
    const sections = ['home', 'features', 'services', 'about', 'contact'];
    let currentSection = '';

    for (const section of sections) {
      const element = document.getElementById(section);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
          currentSection = section;
          break;
        }
      }
    }

    if (this.activeSection !== currentSection) {
      this.activeSection = currentSection;
      this.cdr.detectChanges();
    }
  }

  scrollToHomeSection(sectionId: string): void {
    if (this.isHomePage) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        this.activeSection = sectionId;
        // Update URL without navigation
        this.router.navigate([], {
          fragment: sectionId,
          replaceUrl: true,
          queryParamsHandling: 'preserve'
        });
        this.cdr.detectChanges();
      }
    } else {
      // Navigate to home page with fragment
      this.router.navigate(['/home'], { fragment: sectionId });
    }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  getUserInitials(): string {
    if (!this.user || !this.user.profile_image) return 'U';
    const names = this.user.username.split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : names[0][0].toUpperCase();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        sessionStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        // Clear user data
        this.isLoggedIn = false;
        this.user = null;
        localStorage.removeItem('user_profile'); // Ensure local storage is also cleared

        // Force UI update in multiple ways
        this.cdr.markForCheck();
        setTimeout(() => this.cdr.detectChanges(), 0); // Schedule detection for the next tick

        // Navigate after state change
        this.router.navigate(['/home']);
        this.showDropdown = false;
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Still try to update UI state even if API fails
        this.isLoggedIn = false;
        this.user = null;
        this.cdr.detectChanges();
      }
    });
  }
}
