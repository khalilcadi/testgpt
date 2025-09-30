from collections.abc import AsyncGenerator

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture(autouse=True)
def use_test_settings(monkeypatch):
    monkeypatch.setenv("OTP_BASE_URL", "http://otp.local")
    monkeypatch.setenv("GEOPLATFORME_BASE_URL", "https://api-adresse.data.gouv.fr")
    monkeypatch.setenv("ENABLE_POSTGIS", "false")
