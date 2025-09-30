export type Scenario = 'AM' | 'PM' | 'BOTH';

export interface GeocodeFeature {
  id: string;
  label: string;
  query: string;
  lat: number;
  lon: number;
  score: number;
}

export interface IsochronePolygon {
  origin_id: string;
  scenario: Scenario;
  minutes: number;
  geojson: GeoJSON.FeatureCollection;
}

export interface IsochroneResponse {
  polygons: IsochronePolygon[];
  used_minutes: number;
  tolerance_applied: boolean;
}

export interface StationRanking {
  station_id: string;
  name: string;
  coord: { lat: number; lon: number };
  arrondissement?: string | null;
  quartier?: string | null;
  score_max: number;
  stats: {
    min: number;
    median: number;
    max: number;
  };
  times_by_origin: Record<string, number>;
}

export interface RankStationsResponse {
  stations: StationRanking[];
  total_candidates: number;
  evaluated_at: string;
}
