# NEXA HR & Payroll Platform

Enterprise HR & Payroll SaaS built with **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Prisma · PostgreSQL**.

Backend is implemented as Next.js **route handlers** (single deployable codebase), with JWT access/refresh auth, RBAC permission matrix, multi-tenant data model, audit logging, and soft deletes.

---

## Prerequisites

- Node.js 20+
- A PostgreSQL 14+ database (local Docker, Neon, Supabase, RDS, …)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   → set DATABASE_URL and the JWT secrets (openssl rand -base64 48)

# 3. Create the schema + seed demo data
npm run db:push       # or: npm run db:migrate  (creates a migration)
npm run db:seed

# 4. Run
npm run dev           # http://localhost:3000
```

### Demo accounts (after seeding)

| Role        | Email                 | Password       |
| ----------- | --------------------- | -------------- |
| Super Admin | admin@nexa.co.th      | `Password123!` |
| HR Manager  | hr@nexa.co.th         | `Password123!` |
| Manager     | manager@nexa.co.th    | `Password123!` |
| Employee    | employee@nexa.co.th   | `Password123!` |
| Finance     | finance@nexa.co.th    | `Password123!` |

## Scripts

| Script                | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start dev server (Turbopack)             |
| `npm run build`       | `prisma generate` + production build     |
| `npm run typecheck`   | `tsc --noEmit`                           |
| `npm run lint`        | ESLint                                   |
| `npm run format`      | Prettier write                           |
| `npm run db:push`     | Push schema to DB (no migration history) |
| `npm run db:migrate`  | Create + apply a migration               |
| `npm run db:seed`     | Seed demo company, roles, users          |
| `npm run db:studio`   | Prisma Studio                            |

## Architecture

```
src/
  app/
    (auth)/login/            public login
    (app)/                   authenticated shell (server session gate → AuthProvider → AppShell)
      dashboard/  employees/[id]/  coming-soon/
    api/                     route handlers = backend
      auth/{login,refresh,logout,me}/
      employees/  employees/[id]/  org/options/
  components/
    ui/        shadcn primitives (Base UI based)
    layout/    sidebar, topbar, shell, theme toggle, user menu
    shared/    DataTable, PageHeader, StatCard, states, ConfirmDialog
  features/<module>/          components · hooks (TanStack Query) · api · schema · service · types
  lib/
    prisma.ts                singleton client
    auth/    jwt · password · session · rbac · guard · service · token-store
    api/     response envelope · errors · pagination · request meta · client fetcher
    audit.ts
  config/    permissions (catalog + role presets) · navigation
  providers/ theme · react-query · tooltip · toaster
  middleware.ts              edge auth guard
prisma/  schema.prisma · seed.ts
```

### Security

- **Auth**: JWT access token (15 min) in `httpOnly` cookie + rotating refresh token (14 d) whose SHA-256 hash is stored in `RefreshToken` for revocation & reuse detection.
- **RBAC**: `${module}:${action}` permission keys with wildcards; enforced in every route handler via `requirePermission()` and mirrored on the client via `useAuth().can()`.
- **Multi-tenancy**: every query is scoped by `companyId` from the verified session — never from client input.
- **Validation**: all request bodies/queries parsed with Zod; central error handler maps Zod/Prisma/AppError to a consistent envelope.
- **Audit**: create/update/delete write immutable `AuditLog` rows. Deletes are soft (`deletedAt`).

## Deployment (Cloudflare Pages)

1. Push to GitHub, connect the repo to Cloudflare Pages.
2. Build command `npm run build`; set env vars (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, …) in the Pages dashboard.
3. Run `npm run db:migrate` against the production database as a release step.

> Route handlers using Node APIs (bcryptjs, crypto) are declared `runtime = "nodejs"`.

## Status

Foundation + **Employee** module are complete end-to-end (DB → API → validation → RBAC → UI with loading/empty/error states). Remaining modules (Attendance, Leave, OT, Payroll, Performance, …) follow the same vertical-slice pattern — the nav links to a placeholder until each is built.
