import { useState, useMemo } from "react";
import { Link } from "react-router";
import api from "~/lib/api";
import type { Route } from "./+types/admin-persons";
import { isManager } from "~/lib/utils";
import { usePhotoBlobUrl } from "~/hooks/use-photo-blob-url";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
import {
  ArrowRight,
  Search,
  Loader2,
  ArrowLeftRight,
  GraduationCap,
  Users,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AssignPersonSheet } from "~/components/assign-person-sheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonSearchResult {
  person_id: number;
  person_name: string;
  photo_link: string | null;
  classIds: string;
}

interface ClassInfo {
  class_id: number;
  class_name: string;
  school_id: number;
  school_name: string;
}

type SheetState =
  | { type: "closed" }
  | { type: "assign"; person: PersonSearchResult; personType: "student" | "teacher" };

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function clientLoader() {
  if (!isManager()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const classesRes = await api.get<{ success: boolean; data: ClassInfo[] }>(
    "/accounts/classes",
  );

  return {
    classes: classesRes.data.data,
  };
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminPersons({ loaderData }: Route.ComponentProps) {
  const { classes } = loaderData;

  const [searchType, setSearchType] = useState<"student" | "teacher">("student");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [sheetState, setSheetState] = useState<SheetState>({ type: "closed" });

  // Group classes by school for the select dropdown
  const schoolMap = useMemo(() => {
    const map = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      const key = cls.school_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    }
    return map;
  }, [classes]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      toast.error("اكتب حرفين على الأقل للبحث");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const paramKey = searchType === "student" ? "students" : "teachers";
      const res = await api.get<PersonSearchResult[]>(
        `/persons/${paramKey}`,
        { params: { name: q } },
      );
      setSearchResults(res.data);
    } catch {
      toast.error("حصلت مشكلة في البحث");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1">نقل و تعيين الأشخاص</h1>
      </div>

      {/* Search section */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              variant={searchType === "student" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("student");
                setSearchResults([]);
                setHasSearched(false);
              }}
            >
              <GraduationCap className="size-4" />
              مخدومين
            </Button>
            <Button
              variant={searchType === "teacher" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("teacher");
                setSearchResults([]);
                setHasSearched(false);
              }}
            >
              <Users className="size-4" />
              خدام
            </Button>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder={`بحث عن ${searchType === "student" ? "مخدوم" : "خادم"} بالاسم...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching} size="default">
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search results */}
      {hasSearched && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {searching
              ? "جاري البحث..."
              : `النتائج (${searchResults.length})`}
          </h2>

          {!searching && searchResults.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              لا يوجد نتائج
            </p>
          )}

          {!searching &&
            searchResults.map((person) => (
              <PersonResultCard
                key={person.person_id}
                person={person}
                personType={searchType}
                classes={classes}
                onAssign={() =>
                  setSheetState({
                    type: "assign",
                    person,
                    personType: searchType,
                  })
                }
              />
            ))}
        </div>
      )}

      {/* Assign Sheet */}
      {sheetState.type === "assign" && (
        <AssignPersonSheet
          open
          person={sheetState.person}
          personType={sheetState.personType}
          classes={classes}
          schoolMap={schoolMap}
          onClose={() => setSheetState({ type: "closed" })}
          onSuccess={() => {
            // Re-search to refresh results
            handleSearch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Person Result Card
// ---------------------------------------------------------------------------

function PersonResultCard({
  person,
  personType,
  classes,
  onAssign,
}: {
  person: PersonSearchResult;
  personType: "student" | "teacher";
  classes: ClassInfo[];
  onAssign: () => void;
}) {
  const classIds = person.classIds
    ? person.classIds.split(", ").map((id) => parseInt(id.trim(), 10))
    : [];

  const classNames = classIds
    .map((id) => {
      const cls = classes.find((c) => c.class_id === id);
      return cls ? cls.class_name : `#${id}`;
    })
    .filter(Boolean);

  const { blobUrl } = usePhotoBlobUrl(person.photo_link, "sm");

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {blobUrl ? (
            <img
              src={blobUrl}
              alt={person.person_name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <User className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="font-semibold text-sm truncate">
            {person.person_name}
          </span>
          <div className="flex flex-wrap gap-1">
            {classNames.length > 0 ? (
              classNames.map((name, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">لا يوجد فصول</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAssign}>
          <ArrowLeftRight className="size-4" />
          تعيين
        </Button>
      </CardContent>
    </Card>
  );
}
