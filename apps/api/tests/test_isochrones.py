import json

import respx
from httpx import Response


@respx.mock
async def test_isochrones_tolerance_applied(client):
    polygon = {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[2.34, 48.85], [2.35, 48.85], [2.35, 48.86], [2.34, 48.86], [2.34, 48.85]]]
                }
            }
        ]
    }

    def handler(request):
        cutoff = int(request.url.params.get('cutoffSec'))
        if cutoff == 45 * 60:
            return Response(200, json={'type': 'FeatureCollection', 'features': []})
        return Response(200, json=polygon)

    respx.get('http://otp.local/otp/routers/idf/isochrone').mock(side_effect=handler)

    payload = {
        'origins': [
            {'id': 'O1', 'lat': 48.85, 'lon': 2.35},
            {'id': 'O2', 'lat': 48.86, 'lon': 2.34}
        ],
        'minutes': 45,
        'scenario': 'AM'
    }

    response = await client.post('/isochrones', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['used_minutes'] == 50
    assert data['tolerance_applied'] is True
    assert len(data['polygons']) == 4
