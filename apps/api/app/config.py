from enum import Enum
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Scenario(str, Enum):
    AM = "AM"
    PM = "PM"
    BOTH = "BOTH"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    otp_base_url: str = "http://otp:8080"
    otp_router: str = "idf"
    geoplatforme_base_url: str = "https://api-adresse.data.gouv.fr"
    am_time: str = "08:30"
    pm_time: str = "18:00"
    default_scenario: Scenario = Scenario.AM
    default_buffer_meters: int = 250
    enable_postgis: bool = False
    database_url: str | None = None
    otp_timeout_seconds: float = 30.0
    otp_max_retries: int = 3
    otp_retry_backoff_seconds: float = 1.5
    otp_walk_reluctance: float = 2.0
    otp_max_transfers: int = 3
    otp_max_walk_distance: int = 1200

    geocode_timeout_seconds: float = 10.0
    geocode_max_results: int = 5

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
