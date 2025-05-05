import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '../../../auth/service/auth.service';
import { User } from '../../../chat/models/user.interface';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-settings-menu',
  templateUrl: './settings-menu.component.html',
  styleUrls: ['./settings-menu.component.scss']
})
export class SettingsMenuComponent {
  @Input() isOpen = false;
  @Input() currentUser: User | null = null;
  @Output() close = new EventEmitter<void>();

  isDarkMode = false;

  constructor(
    private themeService: ThemeService,
    private authService: AuthService
  ) {
    this.isDarkMode = this.themeService.getCurrentTheme() === 'dark';
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    this.themeService.setTheme(
      this.isDarkMode ? 'dark' : 'light'
    );
  }

  logout(): void {
    this.authService.logout();
    this.close.emit();
  }

  viewProfile(): void {
    // Navigate to profile page or expand profile section
    console.log('Navigate to profile page');
    // Implementation depends on your routing setup
  }

  closeMenu(): void {
    this.close.emit();
  }
}
