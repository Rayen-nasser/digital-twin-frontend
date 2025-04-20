import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);
  public darkMode$ = this.darkMode.asObservable();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initializeTheme();
  }

  private initializeTheme(): void {
    if (!this.isBrowser) return;

    // First check localStorage
    const savedTheme = localStorage.getItem('darkMode');

    if (savedTheme === null) {
      // Check system preference if no saved setting
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark, false);
    } else {
      this.setDarkMode(savedTheme === 'true');
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', e => {
        if (localStorage.getItem('darkMode') === null) {
          this.setDarkMode(e.matches, false);
        }
      });
  }

  setDarkMode(isDark: boolean, saveToStorage: boolean = true): void {
    if (!this.isBrowser) return;

    this.darkMode.next(isDark);

    if (saveToStorage) {
      localStorage.setItem('darkMode', isDark.toString());
    }

    // Direct DOM manipulation for immediate effect
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleDarkMode(): void {
    const currentState = this.darkMode.value;
    this.setDarkMode(!currentState);
  }

  isDarkMode(): boolean {
    return this.darkMode.value;
  }
}
