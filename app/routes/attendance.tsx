import api from "~/lib/api";
import type { Route } from "./+types/attendance";
import { Button } from "~/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Link } from "react-router";
import { fetchAndCache } from "~/lib/sync-manager";
import { CLASSES_KEY } from "~/lib/offline-db";
import { Skeleton } from "~/components/ui/skeleton";

type SchoolWithClasses = {
  school_id: number;
  school_name: string;
  classes: { class_id: number; class_name: string }[];
};

export async function clientLoader() {
  const schools = await fetchAndCache<SchoolWithClasses[]>(
    CLASSES_KEY,
    async () => {
      const res = await api.get<SchoolWithClasses[]>("/classes");
      return res.data;
    }
  );
  return { schools };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function Attendance({ loaderData }: Route.ComponentProps) {
  const { schools } = loaderData;
  return (
    <>
      <h1 className="text-xl font-bold">تسجيل الحضور</h1>
      <p className="text-muted-foreground mb-4">اختر الفصل لتسجيل الحضور</p>
      {schools.length > 1 ? (
        <MultipleSchoolsLayout schools={schools} />
      ) : (
        <OneSchoolLayout classes={schools[0].classes} />
      )}
    </>
  );
}

function OneSchoolLayout({
  classes,
}: {
  classes: { class_id: number; class_name: string }[];
}) {
  return <ClassesCol classes={classes} />;
}

function MultipleSchoolsLayout({
  schools,
}: {
  schools: {
    school_id: number;
    school_name: string;
    classes: { class_id: number; class_name: string }[];
  }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {schools.map((school) =>
        school.classes.length > 3 ? (
          <SchoolWithManyClasses key={school.school_id} school={school} />
        ) : (
          <SchoolWithFewClasses key={school.school_id} school={school} />
        )
      )}
    </div>
  );
}

function SchoolWithManyClasses({
  school,
}: {
  school: {
    school_id: number;
    school_name: string;
    classes: { class_id: number; class_name: string }[];
  };
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="justify-start text-lg p-5">
          {school.school_name}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <ClassesCol classes={school.classes} />
      </PopoverContent>
    </Popover>
  );
}

function SchoolWithFewClasses({
  school,
}: {
  school: {
    school_id: number;
    school_name: string;
    classes: { class_id: number; class_name: string }[];
  };
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{school.school_name}</h2>
      <ClassesCol classes={school.classes} />
    </div>
  );
}

function ClassesCol({
  classes,
}: {
  classes: { class_id: number; class_name: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {classes.map((cls) => (
        <Button
          key={cls.class_id}
          className="justify-start text-lg p-5"
          asChild
        >
          <Link to={`/attendance/${cls.class_id}`}>{cls.class_name}</Link>
        </Button>
      ))}
    </div>
  );
}