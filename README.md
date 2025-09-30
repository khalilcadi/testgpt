# Île-de-France Transit Meeting Point – MVP

This repository contains a production-ready MVP for computing a common transit-accessible zone in Île-de-France from multiple addresses and surfacing the top candidate stations. The monorepo ships with a Next.js web client, a FastAPI backend, an OpenTripPlanner (OTP) instance, reproducible data preparation scripts, and Docker Compose orchestration.

## Repository layout

```
.
├── apps
│   ├── api             # FastAPI backend
│   └── web             # Next.js + MapLibre frontend
├── infra
│   ├── data            # Downloaded GTFS / OSM assets (gitignored)
│   ├── graphs          # OTP graph build outputs (gitignored)
│   └── scripts         # Data fetch & graph build scripts
├── docker-compose.yml
└── README.md
```

## Features

- Address autocomplete & geocoding via API Adresse / Géoplateforme (no paid APIs)
- Isochrone generation using self-hosted OpenTripPlanner v2 with IDFM GTFS & OSM
- Intersection tolerance (+5 minutes fallback) with optional PostGIS acceleration
- Top 5 station ranking with arrondissement / quartier enrichment
- MapLibre visualization with interactive sidebar and tolerance indicators
- Extensive tests (FastAPI unit tests, Playwright E2E), linting, and CI pipeline

## Requirements

- Docker & Docker Compose v2
- Node.js 18+
- Python 3.11+
- pnpm 8+ (for monorepo dependency management)

## Getting started (development)

1. **Install dependencies**

   ```bash
   pnpm install
   pnpm install --filter web
   pnpm install --filter api --prod false
   python -m venv .venv && source .venv/bin/activate && pip install -r apps/api/requirements.txt
   ```

2. **Download transport data & build the OTP graph**

   ```bash
   bash infra/scripts/fetch_gtfs_idfm.sh
   bash infra/scripts/fetch_osm_idf.sh
   bash infra/scripts/build_otp_graph.sh
   ```

3. **Run services locally**

   ```bash
   docker compose up --build
   ```

   The frontend is available on `http://localhost:3000`, backend on `http://localhost:8000`, and OTP on `http://localhost:8080`.

4. **Environment configuration**

   Copy `.env.example` to `.env` (root) and override variables if needed. Docker Compose loads it automatically.

## Testing

- **Backend unit tests**: `cd apps/api && pytest`
- **Frontend lint**: `cd apps/web && pnpm lint`
- **Frontend tests (Playwright)**: `cd apps/web && pnpm test:e2e`

GitHub Actions (see `.github/workflows/ci.yml`) runs linting, unit tests, and Playwright checks on every push.

## Production deployment (VPS)

1. Provision a Linux host (Ubuntu 22.04 recommended) with 4 vCPU / 16 GB RAM.
2. Install Docker, Docker Compose, and configure swap (OTP benefits from RAM).
3. Clone the repository, copy `.env.production` → `.env`, adjust secrets (API keys, OTP tuning), and fetch datasets via the provided scripts.
4. Build the OTP graph once using `bash infra/scripts/build_otp_graph.sh`.
5. Launch the stack with `docker compose -f docker-compose.yml --env-file .env up -d --build`.
6. Monitor logs with `docker compose logs -f api web otp`.

## Data privacy

- Addresses are never persisted in storage; only hashed identifiers are logged.
- Logs exclude personal data and third-party cookies are disabled.

## Limitations

- Uses scheduled transit data (no live disruption feeds).
- AM/PM scenarios are fixed to next Monday 08:30/18:00 but configurable via env vars.
- Intersection tolerance limited to +10 min escalation (T+5 automatic, optional UI trigger for T+10).

## Extensions (V2 roadmap)

- Enable PostGIS-backed intersections and spatial joins via feature flag.
- Implement OTP response caching (keyed by geohash, minutes, scenario).
- Add heatmap visualizations for aggregated travel friction.

---

See the documentation in `apps/api/README.md` and `apps/web/README.md` for service-specific details.
