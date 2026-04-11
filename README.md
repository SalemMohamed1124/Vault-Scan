# VaultScan

> AI-Powered Vulnerability Scanner — Graduation Project
> Damietta University, Faculty of Computers & AI

## Features

- **Multi-tenant organization management** with role-based access control (Admin/Editor/Viewer)
- **Asset management** — domains, IPs, URLs, CIDR ranges
- **Quick & Deep vulnerability scans** using Python security scripts
- **AI-powered analysis** via Google Gemini with risk scoring and recommendations
- **Real-time scan progress** via Server-Sent Events (SSE)
- **Scheduled recurring scans** — daily, weekly, monthly
- **Report generation** in PDF, JSON, and HTML formats
- **Dark-themed dashboard** with interactive charts and data visualization

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | NestJS 11, TypeORM, PostgreSQL 15 |
| Queue | BullMQ + Redis 7 |
| AI | Google Gemini API |
| Scanning | Python 3.11+ (nmap, SSL checks, SQLi/XSS testing) |
| Auth | JWT (access + refresh tokens) |
| Reports | Puppeteer (PDF generation) |
| Docs | Swagger / OpenAPI |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose

### Installation

```bash
# Clone and setup
git clone <repo-url>
cd vaultscan

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your GEMINI_API_KEY
npm install
npm run build
npm run migration:run
npm run db:seed
npm run start:dev

# Frontend setup (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Admin123! |
| Editor | editor@demo.com | Editor123! |
| Viewer | viewer@demo.com | Viewer123! |

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://vaultscan:vaultscan_secret@localhost:5434/vaultscan` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | — |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6380` |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash-exp` |
| `PORT` | API server port | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Frontend (`.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |

## Architecture

```
vaultscan/
  backend/           # NestJS API server
    src/
      modules/       # Feature modules (auth, scans, assets, etc.)
      common/        # Shared guards, decorators, enums
      config/        # TypeORM, Redis, Gemini config
      database/      # Seed script
      migrations/    # TypeORM migrations
  frontend/          # Next.js dashboard
    src/
      app/           # App Router pages
      components/    # UI components (shadcn/ui + custom)
      hooks/         # Custom React hooks
      lib/           # API client, auth, utilities
  scripts/           # Python scan scripts
  docker-compose.yml # Infrastructure services
```

## API Documentation

Available at http://localhost:3001/api/docs (Swagger UI) when the backend is running.

## Scan Scripts

| Script | Purpose |
|--------|---------|
| `chk_quick.py` | HTTP headers, HTTPS redirect, .env exposure |
| `chk_01_sql.py` | SQL injection testing |
| `chk_02_xss.py` | Cross-site scripting testing |
| `chk_17_nmap.py` | Port scanning (nmap or socket fallback) |
| `ssl_checker.py` | SSL/TLS certificate validation |
| `service_fingerprint.py` | Service banner grabbing |

Set `SCAN_MOCK_MODE=true` to use mock data during development.

## Docker Production Build

```bash
# Build and start everything
docker compose -f docker-compose.yml up --build -d

# The stack includes:
# - PostgreSQL 15 (port 5434)
# - Redis 7 (port 6380)
# - Backend API (port 3001)
# - Frontend (port 3000)
```

## License

This project is part of a graduation thesis and is not licensed for commercial use.
