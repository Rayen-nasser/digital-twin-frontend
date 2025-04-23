import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private apiUrl = environment.apiUrl + '/twin';

  constructor(
    private http: HttpClient
  ) { }

  getTwins(
    params: any
  ){
    return this.http.get(this.apiUrl);
  }
}
