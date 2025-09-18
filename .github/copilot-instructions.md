# Copilot Instructions for moftaked-client-web

This is a modern React application built with **React Router 7** (not Remix), using SPA mode with SSR disabled. The project emphasizes type safety, modern tooling, and clean architecture patterns.

## Architecture Overview

- **Framework**: React Router 7 with SPA mode (`ssr: false` in `react-router.config.ts`)
- **Build Tool**: Vite with React Router plugin
- **Styling**: Tailwind CSS 4.x with custom Inter font theme
- **Type System**: Strict TypeScript with path aliases (`~/*` → `./app/*`)
- **Deployment**: Docker-based with multi-stage builds

## Key Patterns & Conventions

### Routing Structure
- Routes defined in `app/routes.ts` using `RouteConfig` pattern:
  ```typescript
  export default [
    index("routes/home.tsx"),
    route("/login", "routes/login.tsx"),
  ] satisfies RouteConfig;
  ```
- Route components in `app/routes/` directory
- Type-safe route meta functions: `export function meta({}: Route.MetaArgs)`
- Auto-generated types in `+types/` directories for each route

### Component Structure
- `app/root.tsx` defines the HTML layout with `Layout` component
- Global error boundary with dev-mode stack traces
- `<Outlet />` pattern for nested routing
- Links function for external resources (fonts, etc.)

### Development Commands
- `npm run dev` - Start development server (not `npm start`)
- `npm run build` - Production build using React Router CLI
- `npm run start` - Serve production build
- `npm run typecheck` - Run type generation + TypeScript check

### Styling Approach
- Import Tailwind in `app/app.css` with `@import "tailwindcss"`
- Custom theme using `@theme` directive with CSS custom properties
- Dark mode support via `prefers-color-scheme`
- Container classes and responsive utilities preferred

### File Organization
- Use `~/*` imports for app directory (configured in tsconfig paths)
- Route components export default function + optional meta/loader functions
- Keep route-specific types in co-located `+types/` directories

### Docker Deployment
- Multi-stage build optimized for production
- Separate dev/prod dependency layers
- Runs on port 3000 in container
- Build output: `build/client/` (static) + `build/server/` (Node.js)

## Common Tasks

**Adding a new route:**
1. Create component in `app/routes/your-route.tsx`
2. Add route definition to `app/routes.ts`
3. Use `Route.MetaArgs` type for meta functions

**Styling components:**
- Use Tailwind utility classes directly
- Leverage container classes for layout
- Follow dark mode patterns with `dark:` variants

**Type safety:**
- Import route types from `+types/route-name`
- Use satisfies for route configs and strict TypeScript
- Leverage auto-generated types for data loading

This is a React Router 7 application in SPA mode - avoid Remix-specific patterns and use React Router's modern file-based routing system.