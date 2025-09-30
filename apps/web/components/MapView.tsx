'use client';

import bbox from '@turf/bbox';
import { useEffect, useRef } from 'react';
import maplibregl, { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { GeocodeFeature, StationRanking } from '../lib/types';

interface MapViewProps {
  intersection: GeoJSON.Feature | null;
  stations: StationRanking[];
  origins: GeocodeFeature[];
}

export function MapView({ intersection, stations, origins }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [2.3522, 48.8566],
      zoom: 10
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('intersection', {
        type: 'geojson',
        data: intersection ?? {
          type: 'FeatureCollection',
          features: []
        }
      });
      map.addLayer({
        id: 'intersection-fill',
        type: 'fill',
        source: 'intersection',
        paint: {
          'fill-color': '#1D4ED8',
          'fill-opacity': 0.25
        }
      });
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      map.addLayer({
        id: 'stations-layer',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 6,
          'circle-color': '#1D4ED8',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    const source = map.getSource('intersection') as GeoJSONSource | undefined;
    if (source) {
      source.setData(
        intersection ?? {
          type: 'FeatureCollection',
          features: []
        }
      );
    }
    if (intersection) {
      const bounds = bbox(intersection as any);
      map.fitBounds(bounds as [number, number, number, number], { padding: 40, duration: 600 });
    } else if (origins.length > 0) {
      const coords = origins.map((origin) => [origin.lon, origin.lat]);
      const bounds = coords.reduce(
        (acc, coord) => {
          return [
            Math.min(acc[0], coord[0]),
            Math.min(acc[1], coord[1]),
            Math.max(acc[2], coord[0]),
            Math.max(acc[3], coord[1])
          ];
        },
        [coords[0][0], coords[0][1], coords[0][0], coords[0][1]] as [number, number, number, number]
      );
      map.fitBounds(bounds, { padding: 40, duration: 600 });
    }
  }, [intersection, origins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    const source = map.getSource('stations') as GeoJSONSource | undefined;
    if (!source) {
      return;
    }
    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: stations.map((station) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.coord.lon, station.coord.lat]
        },
        properties: {
          name: station.name,
          score: station.score_max,
          arrondissement: station.arrondissement ?? '—',
          quartier: station.quartier ?? '—'
        }
      }))
    };
    source.setData(featureCollection);

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    stations.forEach((station) => {
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false }).setHTML(
        `<div class="text-sm"><strong>${station.name}</strong><br/>Score max : ${Math.round(
          station.score_max
        )} min<br/>${station.arrondissement ?? ''}</div>`
      );
      const marker = new maplibregl.Marker({ color: '#1D4ED8' })
        .setLngLat([station.coord.lon, station.coord.lat])
        .setPopup(popup);
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [stations]);

  return <div ref={mapContainerRef} className="map-container" />;
}
