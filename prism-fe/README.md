# PRISM Frontend — AI-Powered Reliability Engineering Platform

PRISM is a next-generation, enterprise-grade incident detection and remediation platform that leverages autonomous AI agents to identify, investigate, and propose fixes for production incidents in real time. Built with a Splunk-inspired observability design language for SRE teams, platform engineers, and engineering leadership.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite 7 |
| Language | Type Script (strict mode) |
| Styling | Tailwind CSS v4 with custom design tokens |
| UI Components | shadcn/ui (Radix UI primitives) |
| State Management | Zustand (with persistence) |
| Data Fetching | TanStack React Query |
| Animation | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | TanStack Router (file-based) |

---

## Key Features

- **Command Center** — Live system health dashboard with telemetry charts and AI activity feed
- **Incident Management** — Source filtering (All / Detected / AI Predicted) with severity classification
- **AI Predicted Incidents** — CDTSM-generated predictions with failure window estimation and BrainCircuit badge
- **Deep Investigation** — Telemetry analysis, root cause, suspected PR with diff viewer, dependency graph
- **Remediation** — One-click fix PR generation with full validation pipeline (lint, tests, security scan)
- **PR Traceback** — Correlate incidents to code changes across all connected repositories
- **AI Agents Dashboard** — Real-time agent fleet monitoring with confidence scores and latency metrics
- **Repository Management** — Connected codebases with sync status and incident counts

---

## Project Structure

```
src/
├── api/
│   ├── client.ts                 # Axios HTTP client (base URL, auth interceptors)
│   ├── adapters.ts               # Backend → frontend type adapters
│   └── hooks/                    # TanStack Query hooks per module
├── components/
│   ├── layout/                   # Sidebar, TopNavbar
│   ├── prism/                    # Domain-specific components
│   │   ├── AIActivityTimeline.tsx
│   │   ├── Badges.tsx
│   │   ├── PrismLogo.tsx
│   │   ├── RemediationProgressModal.tsx
│   │   ├── ServiceDependencyGraph.tsx
│   │   └── TelemetryChart.tsx
│   └── ui/                       # shadcn/ui primitives
├── hooks/                        # Shared custom hooks
├── lib/
│   ├── types.ts                  # Core TypeScript interfaces
│   └── utils.ts                  # Utility helpers (cn, etc.)
├── routes/                       # TanStack file-based routes
│   ├── __root.tsx                # Root layout
│   ├── _app.tsx                  # Authenticated app shell
│   ├── _app.dashboard.tsx        # Command center
│   ├── _app.incidents.index.tsx  # Incident list (with source filter)
│   ├── _app.incidents.$id.tsx    # Incident detail + investigation
│   ├── _app.pr-traceback.tsx     # PR correlation view
│   ├── _app.repositories.tsx     # Repo management
│   ├── _app.agents.tsx           # AI agents dashboard
│   ├── _app.remediation.tsx      # Remediation queue
│   ├── _app.settings.tsx         # Platform settings
│   └── login.tsx                 # Authentication page
├── store/
│   └── auth.ts                   # Zustand auth store with hydration
├── styles.css                    # Tailwind v4 + design tokens
└── main.tsx                      # Entry point
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (with npm)
- **PRISM Backend** running at `http://localhost:5000` (see `prism-be/README.md`)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Available at `http://localhost:5173`.

### 3. Build for Production

```bash
npm run build
npm run preview
```

---

## Configuration

The frontend connects to the backend API at `http://localhost:5000` (configured in `src/api/client.ts`).

Ensure the backend is running with:
- Splunk data uploaded (incidents, logs, deployments, metrics)
- MongoDB seeded with repositories and users
- CDTSM host available (if predictions are enabled)

---

## Authentication

JWT-based auth via the backend. Use seeded credentials:

| Field | Value |
|-------|-------|
| Email | `admin@prism.ai` |
| Password | `password123` |

The auth store persists to `localStorage` and includes hydration guards to prevent flash-of-unauthenticated-content on page reload.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier formatting |

---

## Design System

PRISM uses a custom dark-themed design system inspired by enterprise observability platforms:

### Color Tokens
- `--primary` — Electric indigo (agent activity, links, highlights)
- `--critical` — Alert red (errors, critical incidents)
- `--warning` — Amber (warnings, medium severity)
- `--info` — Cyan (informational states, AI predictions)
- `--background` — Deep navy slate
- `--card` / `--surface-2` — Layered panel backgrounds

### UI Patterns
- **Glow accents** — Subtle green glow on primary interactive elements
- **Status dots** — Animated pulsing dots for live states
- **AI Predicted badges** — Info-colored badge with BrainCircuit icon
- **Source filter tabs** — All / Detected / Predicted incident filtering
- **Tabular numbers** — All metrics use tabular-nums for clean alignment

---

## System Architecture

```
PRISM Frontend (:5173) ──> PRISM Backend API (:5000) ──> MongoDB Atlas
                                    |
                        +-----------+-----------+
                        v           v           v
                  Splunk REST   GitHub API  CDTSM Inference
                  (:8089)                   (:8080)
                        |
                        v
                   Gemini AI (LLM)
```

---

## Splunk Data Requirements

The frontend displays data sourced from Splunk. Refer to the backend README (`prism-be/README.md`) for full instructions on:
- Creating required Splunk indexes (`incidents`, `main`, `deployments`, `metrics`)
- Uploading the CSV datasets from `prism-be/splunk-data/`
- Verifying data with SPL queries
