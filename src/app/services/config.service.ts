import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private backend =  {
    protocol: 'http',
    host: '192.168.1.8',
    port: 3000
  };

  constructor() {}

  getBackendLink() {
    return `${this.backend.protocol}://${this.backend.host}:${this.backend.port}`
  }
}
