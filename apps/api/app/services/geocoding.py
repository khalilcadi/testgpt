from __future__ import annotations

import asyncio
import hashlib
from typing import List

import httpx

from ..config import Settings
from ..schemas import GeocodeFeature


def _hash_label(label: str) -> str:
    return hashlib.sha1(label.encode("utf-8")).hexdigest()[:12]


async def _geocode_single(address: str, settings: Settings) -> GeocodeFeature | None:
    params = {
        "q": address,
        "limit": settings.geocode_max_results,
        "autocomplete": 1,
    }
    timeout = httpx.Timeout(settings.geocode_timeout_seconds)
    async with httpx.AsyncClient(base_url=settings.geoplatforme_base_url, timeout=timeout) as client:
        response = await client.get("/search/", params=params)
        response.raise_for_status()
        payload = response.json()

    for feature in payload.get("features", []):
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates", [None, None])
        if not props or coordinates[0] is None:
            continue
        label = props.get("label") or props.get("name") or address
        score = props.get("score") or 0
        return GeocodeFeature(
            id=_hash_label(label + address),
            label=label,
            query=address,
            lat=coordinates[1],
            lon=coordinates[0],
            score=float(score),
        )
    return None


async def geocode_addresses(addresses: List[str], settings: Settings) -> List[GeocodeFeature]:
    tasks = [_geocode_single(address, settings) for address in addresses]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: List[GeocodeFeature] = []
    for result in results:
        if isinstance(result, Exception):
            continue
        if result is None:
            continue
        merged.append(result)
    return merged
