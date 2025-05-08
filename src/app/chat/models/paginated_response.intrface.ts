interface PaginatedResponse<T> {
  count: number;         // Total number of items
  next: string | null;   // URL for the next page
  previous: string | null; // URL for the previous page
  results: T[];          // Array of items (courses in this case)
}
