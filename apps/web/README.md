# Web App

Next.js 13 frontend for the Île-de-France transit meeting point MVP.

## Development

```bash
pnpm install
pnpm dev
```

The app expects the API to run on `NEXT_PUBLIC_OTP_BASE_URL` (defaults to `http://localhost:8000`).

## Testing

Playwright is configured for a smoke E2E scenario:

```bash
pnpm test:e2e
```

## Linting

```bash
pnpm lint
```

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_OTP_BASE_URL` | Base URL for the FastAPI backend |
| `NEXT_PUBLIC_ENABLE_POSTGIS` | Toggle to call backend intersection endpoint |
| `NEXT_PUBLIC_DEFAULT_SCENARIO` | Initial scenario selection |
| `NEXT_PUBLIC_MAPTILER_KEY` | Optional MapTiler key (if switching basemap) |
