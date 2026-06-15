# PRISM Backend — AI Reliability Engineering API

The backend for PRISM, built with Fastify and TypeScript. Provides REST APIs for incident management, AI-powered investigation, predictive analytics via CDTSM, and integrations with Splunk, GitHub, and Gemini AI.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Fastify v5 (ESM) |
| Language | TypeScript (strict) |
| Database | MongoDB Atlas (via Prisma v6) |
| AI / LLM | Google Gemini AI |
| Prediction | Cisco Deep Time Series Model (CDTSM) |
| Observability | Splunk (REST API) |
| VCS Integration | GitHub API |
| Job Queue | BullMQ + Redis (optional) |
| Realtime | Socket.IO |
| Auth | JWT (Fastify JWT) |
| Validation | Zod |

---

## Project Structure

```
prism-be/
├── prisma/
│   └── schema.prisma             # MongoDB data models
├── splunk-data/                   # CSV datasets to upload into Splunk
│   ├── incidents.csv
│   ├── application_logs.csv
│   ├── deployment_events.csv
│   └── service_metrics.csv
├── src/
│   ├── agents/                    # AI Agent ecosystem
│   │   ├── coordinator/           # Multi-agent orchestration
│   │   ├── predictive/            # CDTSM-based prediction agent
│   │   ├── root-cause/            # Root cause analysis agent
│   │   ├── pr-traceback/          # PR correlation agent
│   │   ├── remediation/           # Patch generation agent
│   │   ├── telemetry/             # Telemetry correlation agent
│   │   └── deployment/            # Deployment analysis agent
│   ├── config/
│   │   └── env.ts                 # Environment variable schema (Zod)
│   ├── integrations/
│   │   ├── cdtsm/                 # Cisco Deep Time Series Model client
│   │   ├── gemini/                # Google Gemini AI client
│   │   ├── github/                # GitHub API service
│   │   └── splunk/                # Splunk REST API service
│   ├── jobs/                      # BullMQ workers (optional, requires Redis)
│   ├── middleware/                # Auth & request hooks
│   ├── modules/                   # Route modules
│   │   ├── auth/
│   │   ├── incidents/
│   │   ├── investigations/
│   │   ├── predictions/
│   │   ├── remediations/
│   │   └── repositories/
│   ├── services/
│   ├── sockets/
│   ├── app.ts                     # Fastify app factory
│   └── server.ts                  # Entry point
├── tests/
├── .env.example
├── docker-compose.yml             # Optional Redis container
├── tsconfig.json
└── vitest.config.ts
```

---

## Prerequisites

- **Node.js** 20+ (with npm)
- **MongoDB Atlas** cluster (free tier works)
- **Splunk Enterprise** running locally (default: `https://localhost:8089`)
- **CDTSM Inference Host** (Cisco Deep Time Series Model) for predictive analytics
- **GitHub Personal Access Token** with repo scope
- **Google Gemini API Key** for AI agents
- **Redis** (optional, only if `REDIS_ENABLED=true`)

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required `.env` configuration:

```env
NODE_ENV=development
PORT=5000

# MongoDB Atlas
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/prism?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Redis (optional)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# GitHub Integration
GITHUB_TOKEN=ghp_your_github_personal_access_token

# Splunk
SPLUNK_BASE_URL=https://localhost:8089
SPLUNK_USERNAME=admin
SPLUNK_PASSWORD=changeme

# Cisco Deep Time Series Model
CDTSM_BASE_URL=http://localhost:8080
CDTSM_AUTH_TOKEN=your_cdtsm_auth_token

# Predictive Agent
PREDICTION_ENABLED=true
PREDICTION_INTERVAL_MINUTES=2

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:5173
```

### 3. Push Database Schema

```bash
npx prisma db push
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed the Database

```bash
npm run seed
```

### 6. Upload Data to Splunk

See [Splunk Data Upload](#splunk-data-upload) below.

### 7. Start Development Server

```bash
npm run dev
```

API available at `http://localhost:5000`.

---

## Splunk Data Upload

PRISM reads incidents, logs, deployments, and service metrics from Splunk. You must create the required indexes and upload the provided CSV datasets.

### Required Indexes

| Index Name | Purpose |
|------------|---------|
| `incidents` | Active and historical incidents |
| `main` | Application logs |
| `deployments` | Deployment events |
| `metrics` | Service time-series metrics (for CDTSM predictions) |

### Upload Steps

For each CSV file in `splunk-data/`:

1. **Create the index** in Splunk Web (`http://localhost:8000`):
   - Go to **Settings > Indexes > New Index**
   - Enter the index name (e.g. `incidents`)
   - Index Data Type: **Events**
   - Click **Save**

2. **Upload the CSV**:
   - Go to **Settings > Add Data > Upload**
   - Select the CSV file from `splunk-data/`
   - Click **Next**

3. **Set Source Type:**
   - Source type: `csv`
   - Timestamp field: `_time`
   - Click **Next**

4. **Input Settings:**
   - Set the **Index** to the matching index name
   - Click **Review > Submit**

### File to Index Mapping

| File | Target Index |
|------|--------------|
| `splunk-data/incidents.csv` | `incidents` |
| `splunk-data/application_logs.csv` | `main` |
| `splunk-data/deployment_events.csv` | `deployments` |
| `splunk-data/service_metrics.csv` | `metrics` |

### Verify Upload

Run these SPL queries in Splunk Search:

```spl
index=incidents | stats count
index=main | stats count
index=deployments | stats count
index=metrics | stats count by serviceName, metric
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run seed` | Seed database |
| `npm test` | Run tests (watch) |
| `npm run test:run` | Run tests once |
| `npm run lint` | ESLint |
| `npm run prisma:push` | Push schema to MongoDB |
| `npm run prisma:generate` | Regenerate Prisma client |

---

## API Endpoints

### Auth
- `POST /auth/register` — Create account
- `POST /auth/login` — Login (returns JWT)
- `GET /auth/me` — Current user

### Incidents
- `GET /incidents` — List all (Splunk + predicted)
- `GET /incidents/:id` — Incident details

### Investigations
- `POST /investigations/:incidentId/trigger` — Trigger AI investigation
- `GET /investigations/:incidentId` — Get results

### Predictions
- `GET /predictions/status` — Scheduler status
- `POST /predictions/trigger` — Manual prediction cycle
- `POST /predictions/start` — Start scheduler
- `POST /predictions/stop` — Stop scheduler

### Remediations
- `POST /remediations/:incidentId/generate` — Generate fix
- `POST /remediations/:incidentId/create-pr` — Create GitHub PR

### Repositories
- `GET /repositories` — List repos
- `POST /repositories` — Add repo

---

## CDTSM Integration

The Predictive Reliability Agent connects to a self-hosted Cisco Deep Time Series Model inference host:

- **Health**: `GET /ready`
- **Inference**: `POST /cdtsm/v1/ai/infer` (Bearer auth)
- **Input**: Coarse + fine context numeric arrays
- **Output**: Mean predictions + quantiles (p10, p50, p90)

The agent fetches metrics from Splunk, runs inference via CDTSM, and creates predicted incidents when anomaly scores exceed thresholds. Critical predictions auto-create GitHub issues.

---

## Architecture

```
Frontend (React) ──> Fastify API (:5000) ──> MongoDB Atlas
                          |
              +-----------+-----------+
              v           v           v
        Splunk REST   GitHub API  CDTSM Inference
        (:8089)                   (:8080)
              |
              v
         Gemini AI (LLM)
```
