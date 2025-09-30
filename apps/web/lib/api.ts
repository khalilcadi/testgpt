import axios from 'axios';

import { GeocodeFeature, IsochroneResponse, RankStationsResponse, Scenario } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_OTP_BASE_URL ?? 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

export async function geocodeAddresses(addresses: string[]): Promise<GeocodeFeature[]> {
  const { data } = await client.post<GeocodeFeature[]>('/geocode', { addresses });
  return data;
}

interface IsochronePayload {
  origins: Array<{ id: string; lat: number; lon: number }>;
  minutes: number;
  scenario: Scenario;
}

export async function fetchIsochrones(payload: IsochronePayload): Promise<IsochroneResponse> {
  const { data } = await client.post<IsochroneResponse>('/isochrones', payload);
  return data;
}

interface RankStationsPayload {
  zone: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Geometry;
  origins: Array<{ id: string; lat: number; lon: number }>;
  scenario: Scenario;
  top: number;
}

export async function fetchRankedStations(payload: RankStationsPayload): Promise<RankStationsResponse> {
  const { data } = await client.post<RankStationsResponse>('/rank-stations', payload);
  return data;
}
