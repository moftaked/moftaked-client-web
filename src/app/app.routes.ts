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
import { TeacherFormComponent } from './teacher-form/teacher-form.component';
import { EventsHomeComponent } from './events-home/events-home.component';
import { ReportComponent } from './report/report.component';
import { EventReportComponent } from './event-report/event-report.component';
import { HeartComponent } from './heart/heart.component';

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
        path: 'attendance',
        component: EventsHomeComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:id',
        component: ClassComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/students/add',
        component: StudentFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/teachers/add',
        component: TeacherFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'student/:studentId/edit',
        component: StudentFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'teacher/:teacherId/edit',
        component: TeacherFormComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/events',
        component: EventsPageComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/events/:eventId/students',
        component: AttendanceComponent,
        canActivate: [authGuard]
    },
    {
        path: 'class/:classId/events/:eventId/teachers',
        component: AttendanceComponent,
        canActivate: [authGuard]
    },
    {
        path: 'report',
        component: ReportComponent,
        canActivate: [authGuard]
    },
    {
        path: 'report/manager/:schoolId/:eventName/:type/:date',
        component: EventReportComponent,
        canActivate: [authGuard]
    },
    {
        path: 'report/class/:classId/:eventName/:type/:date',
        component: EventReportComponent,
        canActivate: [authGuard]
    },
    {
        path: 'bring-em-to-the-church',
        component: HeartComponent,
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
