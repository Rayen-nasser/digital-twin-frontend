import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { SharedService } from '../../service/shared.service';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  twins: any[] = [];
  page: number = 1;
  totalPages: number = 0;
  twinsCount: number = 0;
  page_size: number = 8;
  isLoading: boolean = false;
  displayPages: (number|string)[] = [];
  Math = Math;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sharedService: SharedService
  ) {}

  ngOnInit(): void {
    // Listen for navigation events that might contain fragments
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      const fragment = this.route.snapshot.fragment;
      if (fragment) {
        this.scrollToSection(fragment);
      }
    });

    this.loadTwins();
  }

  loadTwins(): void {
    this.isLoading = true;
    const params = {
      page: this.page,
      page_size: this.page_size
    };

    this.sharedService.getTwins(params).subscribe(
      (response: any) => {
        this.twins = response.results;
        this.twinsCount = response.count;
        this.totalPages = Math.ceil(this.twinsCount / this.page_size);
        this.updateDisplayPages();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading twins:', error);
        this.isLoading = false;
      }
    );
  }

  changePage(newPage: number): void {
    if (typeof newPage !== 'number' || newPage < 1 || newPage > this.totalPages || newPage === this.page) {
      return;
    }

    this.page = newPage;
    this.loadTwins();
    // Scroll to the top of the twins section
    this.scrollToSection('services');
  }
  
  updateDisplayPages(): void {
    this.displayPages = [];

    if (this.totalPages <= 7) {
      // If 7 or fewer pages, show all
      for (let i = 1; i <= this.totalPages; i++) {
        this.displayPages.push(i);
      }
    } else {
      // Always include first page
      this.displayPages.push(1);

      // Complex logic for showing pages with ellipsis
      if (this.page <= 3) {
        this.displayPages.push(2, 3, 4, '...', this.totalPages - 1, this.totalPages);
      } else if (this.page >= this.totalPages - 2) {
        this.displayPages.push('...', this.totalPages - 3, this.totalPages - 2, this.totalPages - 1, this.totalPages);
      } else {
        this.displayPages.push('...', this.page - 1, this.page, this.page + 1, '...', this.totalPages);
      }
    }
  }

  ngAfterViewInit(): void {
    // Handle initial fragment if present with a slight delay to ensure DOM is ready
    setTimeout(() => {
      const fragment = this.route.snapshot.fragment;
      if (fragment) {
        this.scrollToSection(fragment);
      }
    }, 300);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Public method for button clicks in the template
  onScrollToSection(sectionId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.scrollToSection(sectionId);
  }

  // Method to check if an element is currently in viewport
  isElementInViewport(elementId: string): boolean {
    const element = document.getElementById(elementId);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top <= 100 &&
      rect.bottom >= 100
    );
  }
}
