# API Service

FastAPI service powering geocoding, isochrone generation, polygon intersection, and station ranking for the Île-de-France transit meeting point tool.

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `OTP_BASE_URL` | Base URL of the OpenTripPlanner service | `http://otp:8080` |
| `GEOPLATFORME_BASE_URL` | API Adresse base URL | `https://api-adresse.data.gouv.fr` |
| `AM_TIME` | Morning scenario departure time (HH:MM) | `08:30` |
| `PM_TIME` | Evening scenario departure time (HH:MM) | `18:00` |
| `DEFAULT_SCENARIO` | Default scenario (`AM` \| `PM` \| `BOTH`) | `AM` |
| `DEFAULT_BUFFER_METERS` | Buffer distance for station inclusion | `250` |
| `ENABLE_POSTGIS` | Toggle to enable PostGIS intersection pipeline | `false` |
| `DATABASE_URL` | PostGIS connection string (required if PostGIS enabled) | `postgresql://postgres:postgres@db:5432/postgres` |

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API automatically reloads data from `app/data/*` at startup.

## Testing

```bash
pytest
```

## Data refresh

- Replace `data/stations_idf.geojson` with the generated file from the GTFS/OSM processing pipeline.
- Replace `data/arrondissements.geojson` & `data/quartiers.geojson` with official OpenData Paris exports.

## Design notes

- OTP calls are performed concurrently using `asyncio.gather` with timeouts and retries.
- Isochrone tolerance (`T+5`) is handled server-side; the response indicates which cutoff was used.
- When PostGIS is disabled, `/intersect` returns a `501` status, signaling the frontend to fallback to Turf.js.
