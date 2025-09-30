from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from ..config import Settings


@dataclass
class OTPClient:
    settings: Settings

    @property
    def base_url(self) -> str:
        return self.settings.otp_base_url.rstrip("/")

    @property
    def router_path(self) -> str:
        return f"/otp/routers/{self.settings.otp_router}"

    async def _request(self, method: str, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        timeout = httpx.Timeout(self.settings.otp_timeout_seconds)
        url = f"{self.base_url}{self.router_path}{path}"
        backoff = self.settings.otp_retry_backoff_seconds

        last_exc: Exception | None = None
        for attempt in range(1, self.settings.otp_max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.request(method, url, params=params)
                    response.raise_for_status()
                    return response.json()
            except Exception as exc:  # noqa: BLE001
                if attempt == self.settings.otp_max_retries:
                    raise
                await asyncio.sleep(backoff * attempt)
                last_exc = exc
        if last_exc:
            raise last_exc
        raise RuntimeError("OTP request failed without exception context")

    async def fetch_isochrone(
        self,
        origin: Dict[str, float],
        minutes: int,
        departure: datetime,
    ) -> Dict[str, Any]:
        params = {
            "fromPlace": f"{origin['lat']},{origin['lon']}",
            "mode": "TRANSIT,WALK",
            "date": departure.strftime("%Y-%m-%d"),
            "time": departure.strftime("%H:%M"),
            "cutoffSec": minutes * 60,
            "maxWalkDistance": self.settings.otp_max_walk_distance,
            "maxTransfers": self.settings.otp_max_transfers,
            "walkReluctance": self.settings.otp_walk_reluctance,
        }
        return await self._request("GET", "/isochrone", params)

    async def plan_itinerary(
        self,
        origin: Dict[str, float],
        destination: Dict[str, float],
        departure: datetime,
    ) -> Optional[int]:
        params = {
            "fromPlace": f"{origin['lat']},{origin['lon']}",
            "toPlace": f"{destination['lat']},{destination['lon']}",
            "mode": "TRANSIT,WALK",
            "date": departure.strftime("%Y-%m-%d"),
            "time": departure.strftime("%H:%M"),
            "maxWalkDistance": self.settings.otp_max_walk_distance,
            "maxTransfers": self.settings.otp_max_transfers,
            "walkReluctance": self.settings.otp_walk_reluctance,
        }
        data = await self._request("GET", "/plan", params)
        plan = data.get("plan")
        if not plan:
            return None
        itineraries = plan.get("itineraries", [])
        if not itineraries:
            return None
        best = min(itineraries, key=lambda it: it.get("duration", float("inf")))
        duration_seconds = best.get("duration")
        if duration_seconds is None:
            return None
        return round(duration_seconds / 60)
