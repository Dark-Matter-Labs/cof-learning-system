'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PersonOption {
  readonly id: string;
  readonly title: string;
}

interface PersonAutocompleteProps {
  readonly selectedPeople: ReadonlyArray<PersonOption>;
  readonly onChange: (people: ReadonlyArray<PersonOption>) => void;
}

export function PersonAutocomplete({ selectedPeople, onChange }: PersonAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ReadonlyArray<PersonOption>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(q.trim())}&type=person`);
      if (!response.ok) {
        setSuggestions([]);
        return;
      }
      const result = await response.json() as { data: Array<{ id: string; title: string; node_type: string }> };
      const filtered = (result.data ?? [])
        .filter(item => !selectedPeople.some(p => p.id === item.id))
        .map(item => ({ id: item.id, title: item.title }));
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeople]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (person: PersonOption) => {
    onChange([...selectedPeople, person]);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(selectedPeople.filter(p => p.id !== id));
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedPeople.map(person => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-2 py-0.5 text-xs"
            >
              {person.title}
              <button
                type="button"
                onClick={() => handleRemove(person.id)}
                className="hover:text-red-500 transition-colors"
                aria-label={`Remove ${person.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
        placeholder={selectedPeople.length > 0 ? 'Add another person...' : 'Type to search people...'}
        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-node-hunch"
      />

      {isLoading && (
        <p className="mt-1 text-xs text-gray-400">Searching...</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(person => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => handleSelect(person)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {person.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
