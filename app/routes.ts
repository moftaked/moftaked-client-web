import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("layouts/main-layout.tsx", [
    index("routes/home.tsx"),
    route("/class/:classId", "routes/class.tsx"),
    route("/attendance", "routes/attendance.tsx"),
    route("/attendance/:classId", "routes/attendance-class.tsx"),
    route("/attendance/:classId/event/:eventId", "routes/attendance-event.tsx"),
    route("/person/:type/:personId", "routes/person.tsx"),
    route("/reports", "routes/reports.tsx"),
    route("/reports/class/:classId", "routes/reports-class.tsx"),
    route("/reports/class/:classId/event/:eventId", "routes/reports-event.tsx"),
    route("/reports/person/:type/:personId", "routes/reports-person.tsx"),
    route("/more", "routes/more.tsx"),
    route("/settings", "routes/settings.tsx"),
    route("/admin/accounts", "routes/admin-accounts.tsx"),
    route("/admin/classes", "routes/admin-classes.tsx"),
    route("/admin/events", "routes/admin-events.tsx"),
    route("/admin/districts", "routes/admin-districts.tsx"),
  ]),
  route("/login", "routes/login.tsx"),
] satisfies RouteConfig;