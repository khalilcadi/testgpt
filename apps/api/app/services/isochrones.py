from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Dict, List

from ..config import Scenario, Settings
from ..schemas import IsochroneOrigin, IsochronePolygon, IsochroneRequest, IsochroneResponse
from ..utils import combine_geometries, geojson_to_shape, next_monday_at
from .otp import OTPClient


def _departure_for_scenario(scenario: Scenario, settings: Settings) -> datetime:
    if scenario == Scenario.AM:
        return next_monday_at(settings.am_time)
    if scenario == Scenario.PM:
        return next_monday_at(settings.pm_time)
    return next_monday_at(settings.am_time)


def _scenario_map(requested: Scenario) -> List[Scenario]:
    if requested == Scenario.BOTH:
        return [Scenario.AM, Scenario.PM]
    return [requested]


def _collect_geometry(feature_collection: Dict):
    features = feature_collection.get("features", [])
    geoms = [geojson_to_shape(feature.get("geometry")) for feature in features if feature.get("geometry")]
    return combine_geometries(geoms)


async def compute_isochrones(request: IsochroneRequest, settings: Settings) -> IsochroneResponse:
    client = OTPClient(settings)
    scenario_list = _scenario_map(request.scenario)

    tolerance_applied = False
    minutes_to_try = [request.minutes, request.minutes + 5]
    selected_minutes = request.minutes
    polygons: List[IsochronePolygon] = []

    for minutes in minutes_to_try:
        scenario_polygons: List[IsochronePolygon] = []
        scenario_geometries: Dict[Scenario, List] = {scenario: [] for scenario in scenario_list}

        async def _fetch(origin: IsochroneOrigin, scenario: Scenario):
            departure = _departure_for_scenario(scenario, settings)
            origin_dict = {"lat": origin.lat, "lon": origin.lon}
            feature_collection = await client.fetch_isochrone(origin_dict, minutes, departure)
            scenario_polygons.append(
                IsochronePolygon(
                    origin_id=origin.id,
                    scenario=scenario,
                    minutes=minutes,
                    geojson=feature_collection,
                )
            )
            geom = _collect_geometry(feature_collection)
            if geom:
                scenario_geometries[scenario].append(geom)

        tasks = []
        for scenario in scenario_list:
            for origin in request.origins:
                tasks.append(_fetch(origin, scenario))

        await asyncio.gather(*tasks)

        non_empty = True
        for scenario in scenario_list:
            combined = combine_geometries(scenario_geometries[scenario])
            if not combined or combined.is_empty:
                non_empty = False
                break
        if non_empty and request.scenario == Scenario.BOTH:
            am_geom = combine_geometries(scenario_geometries.get(Scenario.AM, []))
            pm_geom = combine_geometries(scenario_geometries.get(Scenario.PM, []))
            if not am_geom or not pm_geom or am_geom.intersection(pm_geom).is_empty:
                non_empty = False

        polygons = scenario_polygons
        selected_minutes = minutes
        tolerance_applied = minutes > request.minutes

        if non_empty or minutes == minutes_to_try[-1]:
            break

    return IsochroneResponse(polygons=polygons, used_minutes=selected_minutes, tolerance_applied=tolerance_applied)
