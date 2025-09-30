from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from pyproj import Transformer
from shapely.geometry import Point
from shapely.ops import transform

from ..config import Scenario, Settings
from ..schemas import IsochroneOrigin, RankStationsRequest, RankStationsResponse, StationRanking
from ..utils import geometry_from_geojson, stats_from_values
from .isochrones import _scenario_map, _departure_for_scenario
from .otp import OTPClient


DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass
class Station:
    station_id: str
    name: str
    point: Point
    properties: Dict

    @property
    def coord(self) -> Dict[str, float]:
        return {"lat": self.point.y, "lon": self.point.x}


class StationRepository:
    def __init__(self) -> None:
        self.transformer_to_m = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        self.transformer_to_deg = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
        self.stations = self._load_stations()
        self.arrondissements = self._load_polygons("arrondissements.geojson")
        self.quartiers = self._load_polygons("quartiers.geojson")

    def _load_geojson(self, filename: str) -> Dict:
        path = DATA_DIR / filename
        with path.open() as fp:
            return json.load(fp)

    def _load_stations(self) -> List[Station]:
        payload = self._load_geojson("stations_idf.geojson")
        stations: List[Station] = []
        for feature in payload.get("features", []):
            geometry = feature.get("geometry")
            if not geometry:
                continue
            point = geometry_from_geojson({"type": "Feature", "geometry": geometry})
            if not isinstance(point, Point):
                continue
            props = feature.get("properties", {})
            stations.append(
                Station(
                    station_id=props.get("id") or props.get("stop_id") or feature.get("id"),
                    name=props.get("name") or props.get("stop_name") or "Unknown",
                    point=point,
                    properties=props,
                )
            )
        return stations

    def _load_polygons(self, filename: str) -> List[Dict]:
        payload = self._load_geojson(filename)
        features = []
        for feature in payload.get("features", []):
            geom = geometry_from_geojson(feature)
            if geom is None:
                continue
            features.append({"geometry": geom, "properties": feature.get("properties", {})})
        return features

    def buffer_geometry(self, geom, meters: int):
        if geom is None:
            return None
        projected = transform(self.transformer_to_m.transform, geom)
        buffered = projected.buffer(meters)
        return transform(self.transformer_to_deg.transform, buffered)

    def filter_stations(self, zone_geojson: Dict, buffer_meters: int) -> List[Station]:
        zone_geom = geometry_from_geojson(zone_geojson)
        if zone_geom is None:
            return []
        buffered = self.buffer_geometry(zone_geom, buffer_meters)
        if buffered is None:
            return []
        return [station for station in self.stations if buffered.contains(station.point)]

    def find_admin_names(self, point: Point) -> Dict[str, Optional[str]]:
        arrondissement = next(
            (feat["properties"].get("name") for feat in self.arrondissements if feat["geometry"].contains(point)),
            None,
        )
        quartier = next(
            (feat["properties"].get("name") for feat in self.quartiers if feat["geometry"].contains(point)),
            None,
        )
        return {"arrondissement": arrondissement, "quartier": quartier}


station_repo = StationRepository()


async def rank_stations(request: RankStationsRequest, settings: Settings) -> RankStationsResponse:
    candidates = station_repo.filter_stations(request.zone, settings.default_buffer_meters)
    scenario_list = _scenario_map(request.scenario)
    client = OTPClient(settings)

    async def evaluate_station(station: Station) -> Optional[StationRanking]:
        station_times: Dict[str, float] = {}
        all_values: List[float] = []

        tasks = []
        meta: List[tuple[str, Scenario]] = []
        for scenario in scenario_list:
            departure = _departure_for_scenario(scenario, settings)
            for origin in request.origins:
                tasks.append(
                    client.plan_itinerary(
                        origin={"lat": origin.lat, "lon": origin.lon},
                        destination={"lat": station.coord["lat"], "lon": station.coord["lon"]},
                        departure=departure,
                    )
                )
                meta.append((origin.id, scenario))

        results = await asyncio.gather(*tasks)
        for (origin_id, scenario), duration in zip(meta, results):
            if duration is None:
                continue
            key = f"{origin_id}:{scenario.value}"
            value = float(duration)
            station_times[key] = value
            all_values.append(value)
        if not station_times:
            return None
        stats = stats_from_values(all_values)
        score_max = stats["max"]
        admin = station_repo.find_admin_names(station.point)
        # collapse scenario dimension for response (per origin max)
        times_by_origin: Dict[str, float] = {}
        for origin in request.origins:
            relevant = [value for key, value in station_times.items() if key.startswith(f"{origin.id}:")]
            if not relevant:
                continue
            times_by_origin[origin.id] = max(relevant)
        return StationRanking(
            station_id=station.station_id,
            name=station.name,
            coord=station.coord,
            arrondissement=admin["arrondissement"],
            quartier=admin["quartier"],
            score_max=score_max,
            stats=stats,
            times_by_origin=times_by_origin,
        )

    tasks = [evaluate_station(station) for station in candidates]
    results = await asyncio.gather(*tasks)
    rankings = [result for result in results if result is not None]
    rankings.sort(key=lambda r: r.score_max)
    top_n = rankings[: request.top]

    return RankStationsResponse(
        stations=top_n,
        total_candidates=len(rankings),
        evaluated_at=datetime.utcnow(),
    )
