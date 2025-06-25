import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import {
  TwinService,
  Twin,
  TwinListResponse,
} from '../../service/twin.service';
import { ThemeService } from '../../../core/services/theme.service';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { ToastrService } from 'ngx-toastr';
import { ChatService } from '../../../chat/services/chat.service';
import { AuthService } from '../../../auth/service/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-list-twin',
  templateUrl: './list-twin.component.html',
  styleUrls: ['./list-twin.component.scss'],
  animations: [
    trigger('slideToggle', [
      state(
        'show',
        style({
          height: '*',
          opacity: 1,
        })
      ),
      state(
        'hide',
        style({
          height: '0',
          opacity: 0,
          overflow: 'hidden',
        })
      ),
      transition('hide <=> show', animate('300ms ease-in-out')),
    ]),
  ],
})
export class ListTwinComponent implements OnInit, OnDestroy {
  // Twin data
  twins: Twin[] = [];
  isLoading = true;
  error: string | null = null;
  totalTwins = 0;
  currentPage = 1;
  pageSize = 12;

  // User authentication status
  isAuthenticated = false;

  // Filter states
  filterForm: FormGroup;
  selectedViewMode: 'all' | 'mine' | 'public' = 'all';
  showFilters = false;
  isDarkMode = false;
  hasFiltersApplied = false;

  // Query params
  queryParams: any = {
    page: 1,
    page_size: 12,
  };

  // Destroy notifier
  private destroy$ = new Subject<void>();

  // Filter options
  privacyOptions = [
    { value: '', label: 'All Privacy Levels' },
    { value: 'public', label: 'Public' },
    { value: 'private', label: 'Private' },
    { value: 'shared', label: 'Shared' },
  ];

  activeOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  sortOptions = [
    { value: '-created_at', label: 'Created (Newest First)' },
    { value: 'created_at', label: 'Created (Oldest First)' },
    { value: '-updated_at', label: 'Updated (Newest First)' },
    { value: 'updated_at', label: 'Updated (Oldest First)' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: '-name', label: 'Name (Z-A)' },
  ];

  constructor(
    private fb: FormBuilder,
    private twinService: TwinService,
    private router: Router,
    private route: ActivatedRoute,
    private themeService: ThemeService,
    private toastService: ToastrService,
    private chatService: ChatService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.filterForm = this.createFilterForm();
  }

  ngOnInit(): void {
    // Check authentication status
    this.isAuthenticated = this.authService.isLoggedIn();
    if (!this.isAuthenticated && this.selectedViewMode === 'mine') {
      this.router.navigate(['/twin'], {
        queryParams: this.route.snapshot.queryParams,
      });
      return;
    }

    // Subscribe to route params
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        // Set initial form values from URL params
        this.setFormFromParams(params);

        // Set view mode based on URL path
        const currentUrl = this.router.url;
        if (currentUrl.includes('/twin/mine')) {
          // If user is not authenticated, redirect to all twins
          if (!this.isAuthenticated) {
            this.router.navigate(['/twin'], { queryParams: params });
            return;
          }
          this.selectedViewMode = 'mine';
        } else if (currentUrl.includes('/twin/public')) {
          this.selectedViewMode = 'public';
        } else {
          this.selectedViewMode = 'all';
        }

        // Build query params
        this.buildQueryParams(params);

        // Check if filters are applied
        this.hasFiltersApplied = this.hasActiveFilters();

        // Load twins
        this.loadTwins();
      });

    // Subscribe to form changes with debounce for better performance
    this.filterForm.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(
          (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe((values) => {
        // Only update URL if user has stopped typing
        this.updateUrlWithFilters(values);
      });

    // Check if filters should be shown based on URL params
    this.showFilters = this.hasActiveFilters();

    // Initialize dark mode state from service
    this.isDarkMode = this.themeService.getCurrentTheme() === 'dark';
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  createFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      privacy_setting: [''],
      is_active: [''],
      ordering: ['-created_at'],
    });
  }

  setFormFromParams(params: any): void {
    this.filterForm.patchValue(
      {
        search: params.search || '',
        privacy_setting: params.privacy_setting || '',
        is_active: params.is_active || '',
        ordering: params.ordering || '-created_at',
      },
      { emitEvent: false }
    );

    this.currentPage = parseInt(params.page || '1', 10);
  }

  buildQueryParams(params: any): void {
    this.queryParams = {
      page: params.page || 1,
      page_size: this.pageSize,
    };

    // Add other params if they exist
    const filterParams = [
      'search',
      'privacy_setting',
      'is_active',
      'ordering',
      'owner',
    ];
    filterParams.forEach((param) => {
      if (params[param]) {
        this.queryParams[param] = params[param];
      }
    });
  }

  loadTwins(): void {
    this.isLoading = true;
    this.error = null;

    // Choose endpoint based on view mode
    let observable;
    if (this.selectedViewMode === 'mine') {
      // Safety check - if not authenticated, force all twins view
      if (!this.isAuthenticated) {
        this.selectedViewMode = 'all';
        this.router.navigate(['/twin'], {
          queryParams: this.route.snapshot.queryParams,
        });
        observable = this.twinService.getAllTwins(this.queryParams);
      } else {
        observable = this.twinService.getMyTwins(this.queryParams);
      }
    } else if (this.selectedViewMode === 'public') {
      observable = this.twinService.getPublicTwins(this.queryParams);
    } else {
      observable = this.twinService.getAllTwins(this.queryParams);
    }

    observable.subscribe({
      next: (response: TwinListResponse) => {
        this.twins = response.results || [];
        this.totalTwins = response.count || 0;
        this.isLoading = false;

        // If there are no results and filters are applied, show toast
        if (this.twins.length === 0 && this.hasActiveFilters()) {
          this.toastService.info(
            'No matches found',
            'Try adjusting your filters to see more results'
          );
        }
      },
      error: (err: any) => {
        console.error('Error loading twins:', err);
        this.isLoading = false;

        // Handle CORS errors specifically
        if (err.status === 0) {
          this.error =
            'Cannot connect to the server. Please check if the server is running and CORS is properly configured.';
          this.toastService.error(
            'Connection error',
            'Cannot reach the server'
          );
        } else {
          this.error = 'Failed to load twins. Please try again later.';
          this.toastService.error(
            'Error loading twins',
            'Please try again later.'
          );
        }

        // Set empty arrays to prevent template errors
        this.twins = [];
        this.totalTwins = 0;
      },
    });
  }

  setViewMode(mode: 'all' | 'mine' | 'public'): void {
    // If user is not authenticated and trying to access "my twins", show notification
    if (mode === 'mine' && !this.isAuthenticated) {
      this.toastService.info(
        'Authentication required',
        'Please log in to view your twins'
      );
      return;
    }

    if (this.selectedViewMode === mode) return;

    this.selectedViewMode = mode;
    this.currentPage = 1;

    // Navigate to appropriate route
    let url = '/twin';
    if (mode === 'mine') {
      url = '/twin/mine';
    } else if (mode === 'public') {
      url = '/twin/public';
    }

    // Reset page number in query params
    const updatedParams = { ...this.filterForm.value, page: 1 };
    this.router.navigate([url], { queryParams: updatedParams });
  }

  updateUrlWithFilters(values: any): void {
    // Only include non-empty values
    const queryParams: any = { page: 1 }; // Reset to first page on filter change

    const filterKeys = Object.keys(values);
    filterKeys.forEach((key) => {
      if (values[key]) {
        queryParams[key] = values[key];
      }
    });

    // Update our local tracking of filter state
    this.hasFiltersApplied = this.hasActiveFilters();

    // Navigate based on current view mode
    let url = '/twin';
    if (this.selectedViewMode === 'mine') {
      url = '/twin/mine';
    } else if (this.selectedViewMode === 'public') {
      url = '/twin/public';
    }

    this.router.navigate([url], { queryParams });
  }

  resetFilters(): void {
    this.filterForm.patchValue({
      search: '',
      privacy_setting: '',
      is_active: '',
      ordering: '-created_at',
    });
    // This will trigger the valueChanges subscription which will update the URL
    this.hasFiltersApplied = false;
    this.toastService.info('Filters reset', 'All filters have been cleared');
  }

  applyFilters(): void {
    // Manual trigger to apply filters - useful for mobile where auto-apply might not be desirable
    const values = this.filterForm.value;
    this.updateUrlWithFilters(values);
    this.hasFiltersApplied = this.hasActiveFilters();
    this.toastService.info('Filters applied', 'Displaying filtered results');
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearSearch(): void {
    this.filterForm.patchValue({
      search: '',
    });
  }

  hasActiveFilters(): boolean {
    const values = this.filterForm.value;
    return !!(
      values.search ||
      values.privacy_setting ||
      values.is_active ||
      (values.ordering && values.ordering !== '-created_at')
    );
  }

  onPageChange(page: number): void {
    if (page === this.currentPage) return;

    this.currentPage = page;

    // Update URL with page number
    const currentParams = { ...this.route.snapshot.queryParams };
    const updatedParams = { ...currentParams, page: page };

    let url = '/twin';
    if (this.selectedViewMode === 'mine') {
      url = '/twin/mine';
    } else if (this.selectedViewMode === 'public') {
      url = '/twin/public';
    }

    this.router.navigate([url], { queryParams: updatedParams });
  }

  toggleTwinActive(twin: Twin, event: Event): void {
    event.stopPropagation(); // Prevent card click navigation

    this.twinService.toggleTwinActive(twin.id).subscribe({
      next: (response: Twin) => {
        // Update twin in local list
        twin.is_active = response.is_active;
        this.toastService.success(
          'Status updated',
          `${twin.name} is now ${twin.is_active ? 'active' : 'inactive'}`
        );
      },
      error: (err: any) => {
        console.error('Error toggling twin active status:', err);
        this.toastService.error(
          'Error updating status',
          'Failed to update twin status'
        );
      },
    });
  }

  duplicateTwin(twin: Twin, event: Event): void {
    // Check if user is authenticated
    if (!this.isAuthenticated) {
      event.stopPropagation();
      this.toastService.info(
        'Authentication required',
        'Please log in to duplicate twins'
      );
      return;
    }

    event.stopPropagation(); // Prevent card click navigation

    this.twinService.duplicateTwin(twin.id).subscribe({
      next: (response: Twin) => {
        this.toastService.success(
          'Twin duplicated',
          `Successfully created a copy of ${twin.name}`
        );
        // Navigate to the new twin
        this.router.navigate(['/twin', response.id]);
      },
      error: (err: any) => {
        console.error('Error duplicating twin:', err);
        this.toastService.error(
          'Error duplicating twin',
          'Failed to create a copy'
        );
      },
    });
  }

  deleteTwin(twin: Twin, event: Event): void {
    // Check if user is authenticated
    if (!this.isAuthenticated) {
      event.stopPropagation();
      this.toastService.info(
        'Authentication required',
        'Please log in to delete twins'
      );
      return;
    }

    event.stopPropagation(); // Prevent card click navigation

    // Use a more user-friendly confirm dialog
    const dialogRef = this.openConfirmDialog({
      title: 'Delete Twin',
      message: `Are you sure you want to delete "${twin.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.twinService.deleteTwin(twin.id).subscribe({
          next: () => {
            // Remove from local list
            this.twins = this.twins.filter((t) => t.id !== twin.id);
            this.totalTwins--;
            this.toastService.success(
              'Twin deleted',
              `${twin.name} has been deleted`
            );
          },
          error: (err) => {
            console.error('Error deleting twin:', err);
            this.toastService.error(
              'Error deleting twin',
              'Failed to delete twin'
            );
          },
        });
      }
    });
  }

  // Helper method for dialog - assumes you have a dialog service
  openConfirmDialog(data: any): any {
    // This is a placeholder - implement with your actual dialog service
    // E.g. return this.dialogService.open(ConfirmDialogComponent, { data });

    // Fallback to native confirm if no dialog service
    const confirmed = confirm(data.message);

    // Mock the dialog afterClosed observable
    return {
      afterClosed: () => ({
        subscribe: (callback: (result: boolean) => void) => {
          callback(confirmed);
        },
      }),
    };
  }

  navigateToTwin(twinId: string): void {
    this.router.navigate(['/twin', twinId]);
  }

  createNewTwin(): void {
    // Check if user is authenticated
    if (!this.isAuthenticated) {
      this.toastService.info(
        'Authentication required',
        'Please log in to create twins'
      );
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.router.navigate(['/twin/create']);
  }

  get totalPages(): number {
    return Math.ceil(this.totalTwins / this.pageSize);
  }

  getPaginationInfo(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalTwins);
    return `${start}-${end} of ${this.totalTwins} twins`;
  }

  getPageNumbers(): number[] {
    const pages = [];
    const totalPages = this.totalPages;

    // Always include first page, last page, current page, and pages close to current
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let startPage = Math.max(2, this.currentPage - 1);
      let endPage = Math.min(totalPages - 1, this.currentPage + 1);

      // Adjust if at boundaries
      if (this.currentPage <= 2) {
        endPage = 3;
      } else if (this.currentPage >= totalPages - 1) {
        startPage = totalPages - 2;
      }

      // Add ellipsis before start page if needed
      if (startPage > 2) {
        pages.push(-1); // -1 represents ellipsis
      }

      // Add range pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis after end page if needed
      if (endPage < totalPages - 1) {
        pages.push(-2); // -2 represents ellipsis
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }

encodeURI(value: string): string {
  if (isPlatformBrowser(this.platformId)) {
    return window.encodeURI(value);
  }
  // Fallback for SSR
  return encodeURIComponent(value);
}

  chatWithTwin(twin: Twin, $event: MouseEvent) {
    $event.stopPropagation();

    // Check if user is authenticated
    if (!this.isAuthenticated) {
      this.toastService.info(
        'Authentication required',
        'Please log in to chat with twins'
      );
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    this.chatService.getChatByTwin(twin.id).subscribe({
      next: (existingChat: any) => {
        if (existingChat) {
          this.router.navigate(['/chat/dashboard']);
        } else {
          const payload = {
            twin: twin.id,
          };

          this.chatService.CreateChat(payload).subscribe({
            next: (response: any) => {
              console.log('Chat created:', response);
              this.router.navigate(['/chat/dashboard']);
            },
            error: (error: any) => {
              console.error('Error creating chat:', error);
              this.toastService.error('Failed to create chat');
            },
          });
        }
      },
      error: (error: any) => {
        console.error('Error checking existing chat:', error);
        this.toastService.error('Failed to check existing chat');
      },
    });
  }
}
