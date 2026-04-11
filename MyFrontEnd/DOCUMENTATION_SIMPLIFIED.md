# Vulnerability Scanner Frontend

## Quick Overview

Vulnerability scanning platform for attack surface monitoring, asset management, and vulnerability tracking.

---

## Tech Stack

- React 19 + TypeScript
- Vite + React Router
- TailwindCSS + Radix UI
- React Query + React Hook Form + Zod
- TanStack React Table (for tables)
- Lucide React (icons) + Sonner (notifications)

---

## Features

**Authentication**: Login/Register with protected routes

**Main Sections**:

- Dashboard (overview)
- Attack Surface (Domains, IPs, Ports)
- Vulnerabilities (Open, Fixed)
- Scans (Assets, Scheduling)
- Settings (Organization, History)

**All Pages Have**: Sorting, filtering, search, pagination, export to Excel, column toggles, mobile responsive

**UI**: Dark/Light theme, sidebar navigation, breadcrumbs, modals, toasts

---

## Routes

```
/                  Landing
/login, /register  Auth
/overview          Dashboard
/domains, /ips, /ports  Attack Surface
/open, /fixed      Vulnerabilities
/assets, /schedule  Scan Management
/organization      Settings
/history/*         Scan History
```

---

## Build & Run

```bash
npm install
npm run dev       # Port 5173
npm run build
```

---

## What to Build

1. **Page Components** - Implement all routes with data tables/forms
2. **Forms** - Login, asset creation, scan scheduling (with Zod validation)
3. **Tables** - Add columns, connect to backend APIs via React Query
4. **State** - Use React Query for server state, Context for UI state
5. **Backend Integration** - Replace mock data with real API calls

---

## Existing Ready-to-Use

- DataTable components with sorting/filtering/export/pagination
- UI component library
- Theme context
- Protected routes
- Modal contexts
- Layout components

**Start building the pages and forms!**
