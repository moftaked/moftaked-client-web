import { Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronLeft, GraduationCap, Building2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassInfo = {
  class_id: number;
  class_name: string;
};

export type SchoolWithClasses = {
  school_id: number;
  school_name: string;
  role?: 'admin' | 'manager' | 'leader' | 'teacher';
  classes: ClassInfo[];
};

interface ClassPickerProps {
  schools: SchoolWithClasses[];
  /** The URL prefix for each class link, e.g. "/class/" or "/attendance/" */
  linkPrefix: string;
  /** Optional render prop for an action element shown in each school section header */
  schoolAction?: (school: SchoolWithClasses) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Color palette – deterministic per class so colors stay consistent across
// visits but each card feels visually distinct.
// ---------------------------------------------------------------------------

const CLASS_COLORS = [
  { bg: "bg-emerald-100 dark:bg-emerald-900/40", icon: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  { bg: "bg-sky-100 dark:bg-sky-900/40", icon: "text-sky-600 dark:text-sky-400", border: "border-sky-200 dark:border-sky-800" },
  { bg: "bg-violet-100 dark:bg-violet-900/40", icon: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", icon: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  { bg: "bg-rose-100 dark:bg-rose-900/40", icon: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", icon: "text-teal-600 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", icon: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", icon: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
];

function getColorForIndex(index: number) {
  return CLASS_COLORS[index % CLASS_COLORS.length];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ClassCard({
  cls,
  linkPrefix,
  colorIndex,
}: {
  cls: ClassInfo;
  linkPrefix: string;
  colorIndex: number;
}) {
  const color = getColorForIndex(colorIndex);

  return (
    <Link to={`${linkPrefix}${cls.class_id}`} className="block group">
      <Card
        className={`relative overflow-hidden transition-all duration-200 hover:shadow-md active:scale-[0.97] ${color.border}`}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={`shrink-0 flex items-center justify-center size-10 rounded-lg ${color.bg}`}
          >
            <GraduationCap className={`size-5 ${color.icon}`} />
          </div>
          <span className="flex-1 text-base font-semibold leading-tight truncate">
            {cls.class_name}
          </span>
          <ChevronLeft className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

function ClassGrid({
  classes,
  linkPrefix,
  colorOffset = 0,
}: {
  classes: ClassInfo[];
  linkPrefix: string;
  /** Offset so colors don't restart at 0 for every school group */
  colorOffset?: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {classes.map((cls, i) => (
        <ClassCard
          key={cls.class_id}
          cls={cls}
          linkPrefix={linkPrefix}
          colorIndex={colorOffset + i}
        />
      ))}
    </div>
  );
}

function SchoolSection({
  school,
  linkPrefix,
  colorOffset,
  action,
}: {
  school: SchoolWithClasses;
  linkPrefix: string;
  colorOffset: number;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-7 rounded-md bg-muted">
          <Building2 className="size-4 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold flex-1">{school.school_name}</h2>
        {action}
      </div>
      <ClassGrid
        classes={school.classes}
        linkPrefix={linkPrefix}
        colorOffset={colorOffset}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClassPicker({ schools, linkPrefix, schoolAction }: ClassPickerProps) {
  // Single school – no need for the school header
  if (schools.length === 1) {
    return (
      <ClassGrid
        classes={schools[0].classes}
        linkPrefix={linkPrefix}
      />
    );
  }

  // Multiple schools – grouped sections
  let colorOffset = 0;

  return (
    <div className="flex flex-col gap-6">
      {schools.map((school) => {
        const offset = colorOffset;
        colorOffset += school.classes.length;
        return (
          <SchoolSection
            key={school.school_id}
            school={school}
            linkPrefix={linkPrefix}
            colorOffset={offset}
            action={schoolAction?.(school)}
          />
        );
      })}
    </div>
  );
}