import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { HomeComponent } from './home/home.component';
import { authGuard } from './auth/auth.guard';
import { EasterEggComponent } from './easter-egg/easter-egg.component';
import { ClassComponent } from './class/class.component';
import { StudentFormComponent } from './student-form/student-form.component';
import { EventsPageComponent } from './events/events-page.component';
import { AttendanceComponent } from './attendance/attendance.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'home',
        component: HomeComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:id',
        component: ClassComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/add',
        component: StudentFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'student/:studentId/edit',
        component: StudentFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/events',
        component: EventsPageComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/events/:eventId',
        component: AttendanceComponent,
        canActivate: [authGuard]
    },
    {
        path: 'easteregg',
        component: EasterEggComponent
    },
    {
        path: '**',
        component: PageNotFoundComponent
    },
];
