// twin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Twin {
  id: string;
  name: string;
  owner: {
    id: string;
    username: string;
    display_name: string;
  };
  persona_data: {
    persona_description: string;
    conversations: Array<{
      question: string;
      answer: string;
    }>;
  };
  description?: string;
  avatar_url: string;
  avatar_details: {
    id: string;
    filename: string;
    file_type: string;
    url: string;
  } | null;
  privacy_setting: 'public' | 'private' | 'shared';
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface TwinListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Twin[];
}

export interface TwinStats {
  total_twins: number;
  active_twins: number;
  public_twins: number;
  private_twins: number;
  unlisted_twins: number;
  twins_per_user: {
    [key: string]: number;
  };
  most_active_twins: Twin[];
}

@Injectable({
  providedIn: 'root',
})
export class TwinService {
  private apiUrl = `${environment.apiUrl}/twin`;

  constructor(private http: HttpClient) {}

  // Get all twins with pagination and filtering
  getAllTwins(params?: any): Observable<TwinListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach((key) => {
        if (
          params[key] !== undefined &&
          params[key] !== null &&
          params[key] !== ''
        ) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<TwinListResponse>(`${this.apiUrl}/`, {
      params: httpParams,
    });
  }

  // Get only the current user's twins
  getMyTwins(params?: any): Observable<TwinListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach((key) => {
        if (
          params[key] !== undefined &&
          params[key] !== null &&
          params[key] !== ''
        ) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<TwinListResponse>(`${this.apiUrl}/mine/`, {
      params: httpParams,
    });
  }

  // Get only public twins
  getPublicTwins(params?: any): Observable<TwinListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach((key) => {
        if (
          params[key] !== undefined &&
          params[key] !== null &&
          params[key] !== ''
        ) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<TwinListResponse>(`${this.apiUrl}/public/`, {
      params: httpParams,
    });
  }

  // Get a single twin by ID
  getTwin(id: string): Observable<Twin> {
    return this.http.get<Twin>(`${this.apiUrl}/${id}/`);
  }

  // Create a new twin
  createTwin(twinData: FormData): Observable<Twin> {
    return this.http.post<Twin>(`${this.apiUrl}/`, twinData);
  }

  // Update an existing twin
  updateTwin(id: string, twinData: FormData): Observable<Twin> {
    return this.http.put<Twin>(`${this.apiUrl}/${id}/`, twinData);
  }

  // Delete a twin
  deleteTwin(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }

  // Toggle the active status of a twin
  toggleTwinActive(id: string): Observable<Twin> {
    return this.http.post<Twin>(`${this.apiUrl}/${id}/toggle_active/`, {});
  }

  // Update just the persona data
  updatePersonaData(id: string, personaData: any): Observable<Twin> {
    return this.http.patch<Twin>(
      `${this.apiUrl}/${id}/update_persona/`,
      personaData
    );
  }

  // Create a copy of a twin
  duplicateTwin(id: string): Observable<Twin> {
    return this.http.post<Twin>(`${this.apiUrl}/${id}/duplicate/`, {});
  }

  // Get statistics about twins (admin only)
  getStats(): Observable<TwinStats> {
    return this.http.get<TwinStats>(`${this.apiUrl}/stats/`);
  }

  shareTwin(
    twin_id: string,
    shareData: { user_email: any; expires_in_days: any }
  ) {
    return this.http.post<any>(`${this.apiUrl}/${twin_id}/share/`, shareData);
  }
}
