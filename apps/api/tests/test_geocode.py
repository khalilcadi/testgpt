import respx
from httpx import Response

from app.config import get_settings


@respx.mock
async def test_geocode_endpoint(client):
    respx.get('https://api-adresse.data.gouv.fr/search/').mock(
        return_value=Response(
            200,
            json={
                'features': [
                    {
                        'properties': {'label': 'Adresse 1', 'score': 0.9},
                        'geometry': {'coordinates': [2.35, 48.86]}
                    }
                ]
            }
        )
    )

    payload = {'addresses': ['14 rue Oberkampf, Paris']}
    response = await client.post('/geocode', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['label'] == 'Adresse 1'
    assert data[0]['lat'] == 48.86
