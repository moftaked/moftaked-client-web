import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from "./login/login.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppHeaderComponent } from "./app-header/app-header.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    LoginComponent,
    FormsModule,
    ReactiveFormsModule,
    AppHeaderComponent,
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'moftaked';
}
