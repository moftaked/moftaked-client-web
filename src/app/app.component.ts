import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from "./login/login.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    LoginComponent,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{
  title = 'moftaked';
  deferredInstallPrompt: any;

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', (event: any) => {this.deferredInstallPrompt = event; console.log('set install prompt')});
  }

  installPwa() {
    this.deferredInstallPrompt.prompt();
  }
}
