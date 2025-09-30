'use client';

import { useEffect, useState } from 'react';

import { useDebounce } from '../lib/hooks';

type Suggestion = {
  label: string;
  value: string;
};

interface AddressInputProps {
  value: string;
  index: number;
  onChange: (value: string) => void;
  onSelect: (label: string) => void;
  onRemove?: () => void;
  disableRemove?: boolean;
  error?: string;
}

export function AddressInput({
  value,
  index,
  onChange,
  onSelect,
  onRemove,
  disableRemove = false,
  error
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedValue = useDebounce(value, 350);

  useEffect(() => {
    async function fetchSuggestions(query: string) {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: '5', autocomplete: '1' });
        const response = await fetch(`https://api-adresse.data.gouv.fr/search/?${params.toString()}`);
        const payload = await response.json();
        const items: Suggestion[] = (payload.features ?? []).map((feature: any) => ({
          label: feature.properties?.label ?? feature.properties?.name ?? query,
          value: feature.properties?.label ?? query
        }));
        setSuggestions(items);
      } catch (error) {
        console.error('autocomplete failed', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSuggestions(debouncedValue);
  }, [debouncedValue]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-600">Adresse {index + 1}</label>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            error ? 'border-red-500' : 'border-slate-300'
          }`}
          placeholder="Ex. 14 rue Oberkampf, Paris"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `address-error-${index}` : undefined}
        />
        {onRemove && !disableRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-red-100 px-2 py-1 text-xs text-red-600"
          >
            Retirer
          </button>
        )}
      </div>
      {error && (
        <p id={`address-error-${index}`} className="text-sm text-red-600">
          {error}
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="space-y-1 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
          {suggestions.map((suggestion) => (
            <li key={suggestion.label}>
              <button
                type="button"
                onClick={() => {
                  onSelect(suggestion.value);
                  setSuggestions([]);
                }}
                className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-primary-500 hover:text-white"
              >
                {suggestion.label}
              </button>
            </li>
          ))}
          {isLoading && <li className="text-xs text-slate-400">Chargement…</li>}
        </ul>
      )}
    </div>
  );
}
