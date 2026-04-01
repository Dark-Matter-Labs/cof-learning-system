'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface NodeOption {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
}

interface NodeSearchAutocompleteProps {
  readonly selectedNode: NodeOption | null;
  readonly onChange: (node: NodeOption | null) => void;
  readonly excludeNodeId?: string;
  readonly placeholder?: string;
}

export function NodeSearchAutocomplete({
  selectedNode,
  onChange,
  excludeNodeId,
  placeholder = 'Type to search nodes...',
}: NodeSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ReadonlyArray<NodeOption>>([]);
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
      const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(q.trim())}`);
      if (!response.ok) {
        setSuggestions([]);
        return;
      }
      const result = await response.json() as { data: Array<{ id: string; title: string; node_type: string }> };
      const filtered = (result.data ?? [])
        .filter(item => item.id !== excludeNodeId)
        .map(item => ({ id: item.id, title: item.title, node_type: item.node_type }));
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } finally {
      setIsLoading(false);
    }
  }, [excludeNodeId]);

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

  const handleSelect = (node: NodeOption) => {
    onChange(node);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedNode !== null && (
        <div className="flex items-center gap-1 mb-2">
          <span className="inline-flex items-center gap-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full px-2 py-0.5 text-xs">
            <span>{selectedNode.title}</span>
            <span className="text-gray-500 dark:text-gray-400 text-[10px]">{selectedNode.node_type}</span>
            <button
              type="button"
              onClick={handleClear}
              className="hover:text-red-500 transition-colors"
              aria-label="Clear selected node"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {selectedNode === null && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-node-hunch"
        />
      )}

      {isLoading && (
        <p className="mt-1 text-xs text-gray-400">Searching...</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(node => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => handleSelect(node)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>{node.title}</span>
                <span className="text-gray-400 dark:text-gray-500 text-[10px]">{node.node_type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
