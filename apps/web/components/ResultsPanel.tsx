'use client';

import { StationRanking } from '../lib/types';

interface ResultsPanelProps {
  stations: StationRanking[];
  isLoading: boolean;
  toleranceApplied: boolean;
  minutes: number;
  onExpandTolerance: () => void;
  hasResults: boolean;
  originLabels: Record<string, string>;
}

export function ResultsPanel({
  stations,
  isLoading,
  toleranceApplied,
  minutes,
  onExpandTolerance,
  hasResults,
  originLabels
}: ResultsPanelProps) {
  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-white p-4 shadow-lg md:w-96">
      <div>
        <h2 className="text-lg font-semibold">Top stations</h2>
        <p className="text-sm text-slate-500">Classement basé sur le temps maximum parmi les origines.</p>
        <p className="mt-2 text-sm text-slate-600">Temps utilisé : {minutes} min</p>
        {toleranceApplied && (
          <div className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">
            Tolérance +5 appliquée automatiquement.
          </div>
        )}
      </div>
      {isLoading && <p className="text-sm text-slate-500">Calcul en cours…</p>}
      {!isLoading && !hasResults && (
        <div className="space-y-3 rounded-md border border-slate-200 p-3 text-sm text-slate-600">
          <p>Aucun résultat pour ce temps de trajet.</p>
          <button
            type="button"
            onClick={onExpandTolerance}
            className="rounded-md bg-primary-500 px-3 py-2 text-white shadow hover:bg-primary-500/90"
          >
            Élargir à T+10
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {stations.map((station, index) => (
          <li key={station.station_id} className="rounded-md border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span className="font-semibold text-slate-700">#{index + 1}</span>
              <span>{station.arrondissement ?? '—'}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-800">{station.name}</h3>
            <p className="text-sm text-slate-500">Quartier : {station.quartier ?? '—'}</p>
            <p className="mt-2 text-sm text-slate-600">Score max : {Math.round(station.score_max)} min</p>
            <p className="text-xs text-slate-500">
              Min/Med/Max : {Math.round(station.stats.min)} / {Math.round(station.stats.median)} / {Math.round(station.stats.max)}
            </p>
            <table className="mt-2 w-full text-left text-xs text-slate-600">
              <thead>
                <tr>
                  <th className="py-1">Origine</th>
                  <th className="py-1">Temps (min)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(station.times_by_origin).map(([originId, value]) => (
                  <tr key={originId}>
                    <td className="py-1 font-medium">{originLabels[originId] ?? originId}</td>
                    <td className="py-1">{Math.round(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </aside>
  );
}
