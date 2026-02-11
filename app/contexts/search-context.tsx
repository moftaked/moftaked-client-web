import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "react-router";

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  isLocalMode: boolean;
  registerLocal: () => () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const location = useLocation();

  const registerLocal = useCallback(() => {
    setLocalCount((c) => c + 1);
    return () => setLocalCount((c) => c - 1);
  }, []);

  const isLocalMode = localCount > 0;

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      setQuery("");
    }
  }, [location.pathname]);

  return (
    <SearchContext.Provider value={{ query, setQuery, isLocalMode, registerLocal }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearchContext must be used within a SearchProvider");
  }
  return ctx;
}

export function useSearchFilter(): string {
  const { query, registerLocal } = useSearchContext();

  useEffect(() => {
    const unregister = registerLocal();
    return unregister;
  }, [registerLocal]);

  return query;
}