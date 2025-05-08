import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient
  ) { }

  getTwins(
    params: any
  ){
    return this.http.get(this.apiUrl + '/twin');
  }

  addSubscribe(email: string){
    return this.http.post(this.apiUrl + '/subscribes/', {email});
  }

  addContact(data: any){
    return this.http.post(this.apiUrl + '/contacts/',data);
  }
}
