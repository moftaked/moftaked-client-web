import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  imports: [],
  templateUrl: './nav-menu.component.html',
  styleUrl: './nav-menu.component.css'
})
export class NavMenuComponent implements OnInit{
  constructor(private router: Router, private route: ActivatedRoute) {}
  isHomeActive = false;
  isEventsActive = false;
  isReportsActive = false;

  ngOnInit(): void {
    const openedRoute = this.route.snapshot.url;
    this.isHomeActive = openedRoute[0].toString() === 'home';
    this.isReportsActive = openedRoute[0].toString() === 'report';
    this.isEventsActive = openedRoute.some((segment) => {return segment.toString() === 'attendance' || segment.toString() === 'events'})

    console.log(this.isHomeActive);
  }
  onClickHome() {
    this.router.navigate(['home'])
  }

  onClickEvents() {
    this.router.navigate(['attendance'])
  }

  onClickReports() {
    this.router.navigate(['report'])
  }
}
