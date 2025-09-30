from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from .config import Scenario


class GeocodeRequest(BaseModel):
    addresses: List[str] = Field(..., min_length=1, max_length=15)

    @field_validator("addresses")
    @classmethod
    def strip_addresses(cls, value: List[str]) -> List[str]:
        cleaned = [addr.strip() for addr in value if addr.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty address is required")
        return cleaned


class GeocodeFeature(BaseModel):
    id: str
    label: str
    query: str
    lat: float
    lon: float
    score: float


class IsochroneOrigin(BaseModel):
    id: str
    lat: float
    lon: float


class IsochronePolygon(BaseModel):
    origin_id: str
    scenario: Scenario
    minutes: int
    geojson: Dict[str, Any]


class IsochroneResponse(BaseModel):
    polygons: List[IsochronePolygon]
    used_minutes: int
    tolerance_applied: bool


class IsochroneRequest(BaseModel):
    origins: List[IsochroneOrigin] = Field(..., min_length=1, max_length=15)
    minutes: int = Field(..., ge=5, le=120)
    scenario: Scenario = Scenario.AM


class IntersectRequest(BaseModel):
    polygons: List[Dict[str, Any]] = Field(..., min_length=1)


class IntersectResponse(BaseModel):
    intersection: Optional[Dict[str, Any]]
    mode: str = Field(default="client", description="client|postgis")


class StationTravelStats(BaseModel):
    min: float
    median: float
    max: float


class StationTimes(BaseModel):
    origin_id: str
    minutes: float
    scenario: Scenario


class StationRanking(BaseModel):
    station_id: str
    name: str
    coord: Dict[str, float]
    arrondissement: Optional[str]
    quartier: Optional[str]
    score_max: float
    stats: StationTravelStats
    times_by_origin: Dict[str, float]


class RankStationsRequest(BaseModel):
    zone: Dict[str, Any]
    origins: List[IsochroneOrigin] = Field(..., min_length=1, max_length=15)
    scenario: Scenario = Scenario.AM
    top: int = Field(default=5, ge=1, le=10)


class RankStationsResponse(BaseModel):
    stations: List[StationRanking]
    total_candidates: int
    evaluated_at: datetime
