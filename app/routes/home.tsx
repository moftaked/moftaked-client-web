import type { Route } from "./+types/home";
import api from "~/lib/api";
import { fetchAndCache } from "~/lib/sync-manager";
import { CLASSES_KEY } from "~/lib/offline-db";
import { Skeleton } from "~/components/ui/skeleton";
import { ClassPicker, type SchoolWithClasses } from "~/components/class-picker";

export async function clientLoader() {
  const schools = await fetchAndCache<SchoolWithClasses[]>(
    CLASSES_KEY,
    async () => {
      const res = await api.get<SchoolWithClasses[]>("/classes");
      return res.data;
    }
  );
  // todo: redirect user if one class
  return { schools };
}

export function HydrateFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
        <Skeleton className="h-18 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { schools } = loaderData;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">الخدمات بتاعتك</h1>
      <ClassPicker schools={schools} linkPrefix="/class/" />
    </div>
  );
}