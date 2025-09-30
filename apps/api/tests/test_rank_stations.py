import respx
from httpx import Response


def build_plan(duration_seconds: int):
    return {
        'plan': {
            'itineraries': [
                {
                    'duration': duration_seconds
                }
            ]
        }
    }


@respx.mock
async def test_rank_stations_endpoint(client):
    durations = [900, 1200, 1100, 1300]

    def handler(request):
        value = durations.pop(0)
        return Response(200, json=build_plan(value))

    respx.get('http://otp.local/otp/routers/idf/plan').mock(side_effect=handler)

    payload = {
        'zone': {
            'type': 'Polygon',
            'coordinates': [
                [
                    [2.33, 48.83],
                    [2.41, 48.83],
                    [2.41, 48.88],
                    [2.33, 48.88],
                    [2.33, 48.83]
                ]
            ]
        },
        'origins': [
            {'id': 'O1', 'lat': 48.83, 'lon': 2.37},
            {'id': 'O2', 'lat': 48.86, 'lon': 2.35}
        ],
        'scenario': 'AM',
        'top': 5
    }

    response = await client.post('/rank-stations', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['total_candidates'] >= 1
    assert data['stations'][0]['station_id']
    assert data['stations'][0]['times_by_origin']['O1'] >= 15
