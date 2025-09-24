import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("layouts/main-layout.tsx", [
    index("routes/home.tsx"),
    route("/more", "routes/more.tsx"),
  ]),
  route("/login", "routes/login.tsx"),
] satisfies RouteConfig;
