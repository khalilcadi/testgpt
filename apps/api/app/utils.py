from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Iterable

import numpy as np
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import unary_union


def next_weekday(now: datetime, weekday: int) -> datetime:
    days_ahead = (weekday - now.weekday() + 7) % 7
    if days_ahead == 0:
        days_ahead = 7
    return now + timedelta(days=days_ahead)


def combine_geometries(geoms: Iterable[Polygon | MultiPolygon]):
    valid = [geom for geom in geoms if geom and not geom.is_empty]
    if not valid:
        return None
    return unary_union(valid)


def geojson_to_shape(geojson):
    return shape(geojson)


def geometry_from_geojson(payload):
    if not payload:
        return None
    geo_type = payload.get("type")
    if geo_type == "FeatureCollection":
        geoms = [geojson_to_shape(feature.get("geometry")) for feature in payload.get("features", []) if feature.get("geometry")]
        return combine_geometries(geoms)
    if geo_type == "Feature":
        return geojson_to_shape(payload.get("geometry"))
    return geojson_to_shape(payload)


def stats_from_values(values: list[float]) -> dict[str, float]:
    if not values:
        return {"min": 0.0, "median": 0.0, "max": 0.0}
    array = np.array(values)
    return {
        "min": float(np.min(array)),
        "median": float(np.median(array)),
        "max": float(np.max(array)),
    }


def parse_time_string(time_str: str) -> time:
    hour, minute = [int(part) for part in time_str.split(":", 1)]
    return time(hour=hour, minute=minute)


def next_monday_at(time_str: str) -> datetime:
    base = next_weekday(datetime.utcnow(), 0)
    t = parse_time_string(time_str)
    return base.replace(hour=t.hour, minute=t.minute, second=0, microsecond=0)
