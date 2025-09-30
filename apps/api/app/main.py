from __future__ import annotations

import json
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .schemas import (
    GeocodeFeature,
    GeocodeRequest,
    IntersectRequest,
    IntersectResponse,
    IsochroneRequest,
    IsochroneResponse,
    RankStationsRequest,
    RankStationsResponse,
)
from .services.geocoding import geocode_addresses
from .services.isochrones import compute_isochrones
from .services.stations import rank_stations

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None


app = FastAPI(title="IDF Transit Meeting Point API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_app_settings() -> Settings:
    return get_settings()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/geocode", response_model=List[GeocodeFeature])
async def geocode_endpoint(payload: GeocodeRequest, settings: Settings = Depends(get_app_settings)):
    results = await geocode_addresses(payload.addresses, settings)
    return results


@app.post("/isochrones", response_model=IsochroneResponse)
async def isochrones_endpoint(payload: IsochroneRequest, settings: Settings = Depends(get_app_settings)):
    return await compute_isochrones(payload, settings)


def _intersect_postgis(polygons: List[dict], settings: Settings) -> dict | None:
    if not psycopg:
        raise HTTPException(status_code=500, detail="psycopg not installed")
    if not settings.database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL missing")
    with psycopg.connect(settings.database_url) as conn:  # type: ignore[call-arg]
        current_geojson = None
        for polygon in polygons:
            serialized = json.dumps(polygon)
            if current_geojson is None:
                current_geojson = serialized
                continue
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ST_AsGeoJSON(ST_Intersection(ST_GeomFromGeoJSON(%s), ST_GeomFromGeoJSON(%s)))",
                    (current_geojson, serialized),
                )
                row = cur.fetchone()
                if not row or row[0] is None:
                    return None
                current_geojson = row[0]
        if current_geojson is None:
            return None
        return json.loads(current_geojson)


@app.post("/intersect", response_model=IntersectResponse)
async def intersect_endpoint(payload: IntersectRequest, settings: Settings = Depends(get_app_settings)):
    if not payload.polygons:
        raise HTTPException(status_code=400, detail="No polygons provided")
    if not settings.enable_postgis:
        raise HTTPException(status_code=501, detail="PostGIS intersection disabled")
    intersection = _intersect_postgis(payload.polygons, settings)
    return IntersectResponse(intersection=intersection, mode="postgis")


@app.post("/rank-stations", response_model=RankStationsResponse)
async def rank_stations_endpoint(payload: RankStationsRequest, settings: Settings = Depends(get_app_settings)):
    return await rank_stations(payload, settings)
