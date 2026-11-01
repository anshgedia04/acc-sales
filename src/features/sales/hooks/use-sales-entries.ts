import { useCallback, useEffect, useRef, useState } from 'react';

import { listSalesEntries, type SalesEntry } from '@/services/sales-api';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load sales entries. Please try again.';
}

export function useSalesEntries() {
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const hasLoadedInitialEntries = useRef(false);

  const loadEntries = useCallback(async (search: string, refresh = false) => {
    const currentRequest = ++requestId.current;
    setError(null);
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const result = await listSalesEntries(search);
      if (currentRequest === requestId.current) setEntries(result);
    } catch (loadError) {
      if (currentRequest === requestId.current) setError(getErrorMessage(loadError));
    } finally {
      if (currentRequest === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const isInitialLoad = !hasLoadedInitialEntries.current;
    const timer = setTimeout(() => {
      hasLoadedInitialEntries.current = true;
      void loadEntries(query);
    }, isInitialLoad ? 0 : 300);
    return () => clearTimeout(timer);
  }, [loadEntries, query]);

  const setSearchQuery = (value: string) => {
    requestId.current += 1;
    setIsSearching(true);
    setQuery(value);
  };

  return { entries, error, isLoading, isRefreshing, isSearching, query, refresh: () => loadEntries(query, true), setQuery: setSearchQuery };
}
