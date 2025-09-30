import { test, expect } from '@playwright/test';

const samplePolygon = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2.34, 48.85],
            [2.36, 48.85],
            [2.36, 48.87],
            [2.34, 48.87],
            [2.34, 48.85]
          ]
        ]
      }
    }
  ]
};

test('user can compute intersection and see stations', async ({ page }) => {
  await page.route('**/geocode', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'o1', label: 'Adresse 1', query: 'a1', lat: 48.82, lon: 2.36, score: 0.99 },
        { id: 'o2', label: 'Adresse 2', query: 'a2', lat: 48.86, lon: 2.35, score: 0.95 },
        { id: 'o3', label: 'Adresse 3', query: 'a3', lat: 48.84, lon: 2.33, score: 0.92 }
      ])
    });
  });

  await page.route('**/isochrones', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        polygons: [
          { origin_id: 'O1', scenario: 'AM', minutes: 45, geojson: samplePolygon },
          { origin_id: 'O2', scenario: 'AM', minutes: 45, geojson: samplePolygon },
          { origin_id: 'O3', scenario: 'AM', minutes: 45, geojson: samplePolygon }
        ],
        used_minutes: 45,
        tolerance_applied: false
      })
    });
  });

  await page.route('**/rank-stations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stations: [
          {
            station_id: 'STATION_1',
            name: 'Châtelet',
            coord: { lat: 48.8583, lon: 2.3471 },
            arrondissement: 'Paris 1er',
            quartier: 'Les Halles',
            score_max: 42,
            stats: { min: 30, median: 38, max: 42 },
            times_by_origin: { O1: 42, O2: 35, O3: 30 }
          }
        ],
        total_candidates: 1,
        evaluated_at: new Date().toISOString()
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Calculer' }).click();
  await expect(page.getByText('Châtelet')).toBeVisible();
  await expect(page.getByText('Score max : 42 min')).toBeVisible();
  await expect(page.locator('.map-container canvas')).toHaveCount(1);
});
