import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Search, X, Loader2, User } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import api from "~/lib/api";
import { useSearchContext } from "~/contexts/search-context";

interface StudentResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  classIds: string | null;
}

interface TeacherResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  classIds: string | null;
}

interface SearchResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  type: "student" | "teacher";
  classIds: string | null;
}

const DEBOUNCE_MS = 350;

export function GlobalSearchBar({ className }: { className?: string }) {
  const { query, setQuery, isLocalMode } = useSearchContext();

  if (isLocalMode) {
    return <LocalFilterBar query={query} setQuery={setQuery} className={className} />;
  }

  return <GlobalSearchMode query={query} setQuery={setQuery} className={className} />;
}

function LocalFilterBar({
  query,
  setQuery,
  className,
}: {
  query: string;
  setQuery: (q: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          dir="auto"
          type="text"
          placeholder="فلتر بالاسم..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9 pe-9 h-10"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function GlobalSearchMode({
  query,
  setQuery,
  className,
}: {
  query: string;
  setQuery: (q: string) => void;
  className?: string;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (term: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (term.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const [studentsRes, teachersRes] = await Promise.allSettled([
        api.get<StudentResult[]>("/persons/students", {
          params: { name: term.trim() },
          signal: controller.signal,
        }),
        api.get<TeacherResult[]>("/persons/teachers", {
          params: { name: term.trim() },
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) return;

      const combined: SearchResult[] = [];

      if (studentsRes.status === "fulfilled") {
        const data = studentsRes.value.data;
        const students = Array.isArray(data) ? data : [];
        for (const s of students) {
          combined.push({
            person_id: s.person_id,
            person_name: s.person_name,
            photo_link: s.photo_link,
            type: "student",
            classIds: s.classIds,
          });
        }
      }

      if (teachersRes.status === "fulfilled") {
        const data = teachersRes.value.data;
        const teachers = Array.isArray(data) ? data : [];
        for (const t of teachers) {
          combined.push({
            person_id: t.person_id,
            person_name: t.person_name,
            photo_link: t.photo_link,
            type: "teacher",
            classIds: t.classIds,
          });
        }
      }

      combined.sort((a, b) => a.person_name.localeCompare(b.person_name));

      setResults(combined);
      setOpen(true);
    } catch (err: any) {
      if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setFocusedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, DEBOUNCE_MS);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  const handleResultClick = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const item = results[focusedIndex];
      if (item) {
        handleResultClick();
        const link = document.querySelector(
          `[data-search-result-index="${focusedIndex}"]`
        ) as HTMLAnchorElement | null;
        link?.click();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusedIndex(-1);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-search-result-index="${focusedIndex}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const typeLabel = (type: string) =>
    type === "student" ? "مخدوم" : "خادم";

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          dir="auto"
          type="text"
          placeholder="ابحث عن شخص..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && query.trim().length >= 2) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="ps-9 pe-9 h-10"
        />
        {(query || loading) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          ref={listRef}
          className="absolute top-full mt-1 inset-x-0 z-50 max-h-80 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              لا توجد نتائج
            </div>
          ) : (
            results.map((person, index) => (
              <Link
                key={`${person.type}-${person.person_id}`}
                to={`/person/${person.type}/${person.person_id}`}
                data-search-result-index={index}
                onClick={handleResultClick}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent",
                  index !== results.length - 1 && "border-b border-border/50",
                  focusedIndex === index && "bg-accent"
                )}
              >
                <SearchResultPhoto photoLink={person.photo_link} name={person.person_name} />

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {person.person_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {typeLabel(person.type)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultPhoto({ photoLink, name }: { photoLink: string | null; name: string }) {
  const { blobUrl } = usePhotoBlobUrl(photoLink, "sm");

  return (
    <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <User className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}