import { Injectable, Renderer2, RendererFactory2, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private renderer: Renderer2;
  private theme = new BehaviorSubject<Theme>('light'); // Default to light
  public theme$ = this.theme.asObservable();
  private isBrowser: boolean;

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initialize();
  }

  private initialize(): void {
    if (!this.isBrowser) {
      return; // Skip initialization if not in browser environment
    }

    const savedTheme = this.getStorageItem('theme') as Theme;
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Use dark theme if user prefers dark mode
      this.setTheme('dark');
    } else {
      // Default to light theme
      this.setTheme('light');
    }

    // Listen for system theme changes
    try {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const mediaQueryChangeHandler = (e: MediaQueryListEvent) => {
        const newTheme: Theme = e.matches ? 'dark' : 'light';
        if (!this.getStorageItem('theme')) {
          this.setTheme(newTheme);
        }
      };

      // Use the appropriate event listener method
      if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', mediaQueryChangeHandler);
      } else if (darkModeMediaQuery.addListener) {
        // For older browsers
        darkModeMediaQuery.addListener(mediaQueryChangeHandler);
      }
    } catch (error) {
      console.error('Could not set up theme listener:', error);
    }
  }

  private getStorageItem(key: string): string | null {
    if (this.isBrowser && localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  }

  private setStorageItem(key: string, value: string): void {
    if (this.isBrowser && localStorage) {
      localStorage.setItem(key, value);
    }
  }

  public getCurrentTheme(): Theme {
    if (this.isBrowser && localStorage) {
      return localStorage.getItem('theme') as Theme || 'light';
    }
    return this.theme.value;
  }

  public setTheme(theme: Theme): void {
    this.theme.next(theme);

    if (this.isBrowser) {
      this.setStorageItem('theme', theme);

      if (theme === 'dark') {
        this.renderer.addClass(document.documentElement, 'dark');
      } else {
        this.renderer.removeClass(document.documentElement, 'dark');
      }
    }
  }

  public toggleTheme(): void {
    const current = this.theme.value;
    const newTheme: Theme = current === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }
}
