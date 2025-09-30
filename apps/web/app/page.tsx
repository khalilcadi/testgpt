'use client';

import { useState } from 'react';
import { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { intersect, union } from '@turf/turf';

import { AddressInput } from '../components/AddressInput';
import { MapView } from '../components/MapView';
import { ResultsPanel } from '../components/ResultsPanel';
import { fetchIsochrones, fetchRankedStations, geocodeAddresses } from '../lib/api';
import { GeocodeFeature, IsochroneResponse, Scenario, StationRanking } from '../lib/types';

type AddressField = {
  id: string;
  value: string;
  error?: string;
};

type AnyPolygon = Feature<Polygon | MultiPolygon>;

function mergeFeatureCollection(collection: FeatureCollection): AnyPolygon | null {
  let merged: AnyPolygon | null = null;
  for (const feature of collection.features as AnyPolygon[]) {
    if (!merged) {
      merged = feature;
    } else {
      try {
        const result = union(merged, feature) as AnyPolygon | null;
        if (result) {
          merged = result;
        }
      } catch (error) {
        console.warn('Union failed', error);
        return null;
      }
    }
  }
  return merged;
}

function intersectPolygons(features: AnyPolygon[]): AnyPolygon | null {
  if (features.length === 0) {
    return null;
  }
  return features.reduce<AnyPolygon | null>((acc, feature) => {
    if (!acc) {
      return feature;
    }
    try {
      const result = intersect(acc, feature) as AnyPolygon | null;
      return result ?? null;
    } catch (error) {
      console.warn('Intersection failed', error);
      return null;
    }
  }, null);
}

function computeIntersection(polygons: IsochroneResponse['polygons'], scenario: Scenario): Feature | null {
  if (!polygons || polygons.length === 0) {
    return null;
  }
  const scenarioBuckets: Scenario[] = scenario === 'BOTH' ? ['AM', 'PM'] : [scenario];

  const scenarioResults: AnyPolygon[] = [];
  for (const scenarioKey of scenarioBuckets) {
    const relevant = polygons.filter((polygon) => polygon.scenario === scenarioKey);
    if (relevant.length === 0) {
      continue;
    }
    const mergedOrigins: AnyPolygon[] = [];
    for (const item of relevant) {
      const merged = mergeFeatureCollection(item.geojson as FeatureCollection);
      if (merged) {
        mergedOrigins.push(merged);
      }
    }
    const intersection = intersectPolygons(mergedOrigins);
    if (intersection) {
      scenarioResults.push(intersection);
    }
  }

  if (scenarioResults.length === 0) {
    return null;
  }
  if (scenarioResults.length === 1) {
    return scenarioResults[0] as Feature;
  }
  const combined = intersectPolygons(scenarioResults);
  return combined as Feature | null;
}

const MIN_ADDRESSES = 3;
const MAX_ADDRESSES = 15;

function buildInitialFields(): AddressField[] {
  return [
    { id: 'A1', value: '41 avenue de Stalingrad, 94400 Vitry-sur-Seine' },
    { id: 'A2', value: '14 rue Oberkampf, 75011 Paris' },
    { id: 'A3', value: '6 place d\'Italie, 75013 Paris' }
  ];
}

export default function HomePage() {
  const [addressFields, setAddressFields] = useState<AddressField[]>(buildInitialFields());
  const [scenario, setScenario] = useState<Scenario>((process.env.NEXT_PUBLIC_DEFAULT_SCENARIO as Scenario) ?? 'AM');
  const [minutes, setMinutes] = useState<number>(45);
  const [geocoded, setGeocoded] = useState<GeocodeFeature[]>([]);
  const [isochroneResponse, setIsochroneResponse] = useState<IsochroneResponse | null>(null);
  const [intersection, setIntersection] = useState<Feature | null>(null);
  const [stations, setStations] = useState<StationRanking[]>([]);
  const [originLabels, setOriginLabels] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequestedMinutes, setLastRequestedMinutes] = useState<number | null>(null);

  const handleAddressChange = (index: number, value: string) => {
    setAddressFields((fields) => {
      const next = [...fields];
      next[index] = { ...next[index], value, error: undefined };
      return next;
    });
  };

  const handleSelectSuggestion = (index: number, value: string) => {
    handleAddressChange(index, value);
  };

  const handleAddAddress = () => {
    if (addressFields.length >= MAX_ADDRESSES) {
      return;
    }
    const nextId = `A${addressFields.length + 1}`;
    setAddressFields([...addressFields, { id: nextId, value: '' }]);
  };

  const handleRemoveAddress = (index: number) => {
    if (addressFields.length <= MIN_ADDRESSES) {
      return;
    }
    const next = [...addressFields];
    next.splice(index, 1);
    setAddressFields(next);
  };

  const prepareOrigins = (features: GeocodeFeature[]) => {
    const map: Record<string, string> = {};
    const origins = features.map((feature, index) => {
      const originId = `O${index + 1}`;
      map[originId] = feature.label;
      return { id: originId, lat: feature.lat, lon: feature.lon };
    });
    setOriginLabels(map);
    return origins;
  };

  const runComputation = async (customMinutes?: number) => {
    const requestedMinutes = customMinutes ?? minutes;
    setLastRequestedMinutes(requestedMinutes);
    setIsLoading(true);
    setError(null);
    try {
      const nonEmpty = addressFields.filter((field) => field.value.trim().length > 0);
      if (nonEmpty.length < MIN_ADDRESSES) {
        throw new Error(`Veuillez renseigner au moins ${MIN_ADDRESSES} adresses.`);
      }
      const addresses = nonEmpty.map((field) => field.value.trim());
      const geocodeResults = await geocodeAddresses(addresses);
      if (geocodeResults.length < nonEmpty.length) {
        throw new Error('Certaines adresses sont introuvables.');
      }
      setGeocoded(geocodeResults);
      const origins = prepareOrigins(geocodeResults);
      const iso = await fetchIsochrones({ origins, minutes: requestedMinutes, scenario });
      setIsochroneResponse(iso);
      const intersectionFeature = computeIntersection(iso.polygons, scenario);
      setIntersection(intersectionFeature);
      if (!intersectionFeature) {
        setStations([]);
        return;
      }
      const ranked = await fetchRankedStations({ zone: intersectionFeature, origins, scenario, top: 5 });
      setStations(ranked.stations);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Impossible de terminer le calcul.');
      setStations([]);
      setIntersection(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runComputation();
  };

  const handleExpandTolerance = async () => {
    const base = lastRequestedMinutes ?? minutes;
    const nextMinutes = base + 10;
    setMinutes(nextMinutes);
    await runComputation(nextMinutes);
  };

  const toleranceApplied = Boolean(isochroneResponse?.tolerance_applied);
  const usedMinutes = isochroneResponse?.used_minutes ?? minutes;
  const hasResults = Boolean(intersection && stations.length > 0);

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <section className="flex w-full flex-col gap-6 bg-slate-100 p-6 md:w-1/3">
        <h1 className="text-2xl font-semibold text-slate-800">Zone commune en transports</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {addressFields.map((field, index) => (
              <AddressInput
                key={field.id}
                value={field.value}
                index={index}
                onChange={(value) => handleAddressChange(index, value)}
                onSelect={(value) => handleSelectSuggestion(index, value)}
                onRemove={() => handleRemoveAddress(index)}
                disableRemove={addressFields.length <= MIN_ADDRESSES}
                error={field.error}
              />
            ))}
            <button
              type="button"
              onClick={handleAddAddress}
              disabled={addressFields.length >= MAX_ADDRESSES}
              className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-primary-500 hover:text-primary-500"
            >
              + Ajouter une adresse
            </button>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-600" htmlFor="minutes">
              Temps de trajet maximum : {minutes} min
            </label>
            <input
              id="minutes"
              type="range"
              min={20}
              max={75}
              step={5}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-600">Scénario</span>
            <div className="flex gap-3">
              {(['AM', 'PM', 'BOTH'] as Scenario[]).map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scenario"
                    value={option}
                    checked={scenario === option}
                    onChange={() => setScenario(option)}
                  />
                  {option === 'AM' ? 'Matin (08:30)' : option === 'PM' ? 'Soir (18:00)' : 'AM & PM'}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-primary-500 px-4 py-2 text-white shadow hover:bg-primary-500/90 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Calcul en cours…' : 'Calculer'}
          </button>
        </form>
      </section>
      <section className="flex w-full flex-1 flex-col md:flex-row">
        <div className="h-96 w-full flex-1 md:h-auto">
          <MapView intersection={intersection} stations={stations} origins={geocoded} />
        </div>
        <ResultsPanel
          stations={stations}
          isLoading={isLoading}
          toleranceApplied={toleranceApplied}
          minutes={usedMinutes}
          onExpandTolerance={handleExpandTolerance}
          hasResults={hasResults}
          originLabels={originLabels}
        />
      </section>
    </main>
  );
}
