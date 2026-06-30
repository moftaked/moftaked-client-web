import { NavLink, Outlet, useNavigate, useLocation, useNavigation as useRRNavigation } from "react-router";
import { SearchProvider } from "~/contexts/search-context";
import { Skeleton } from "~/components/ui/skeleton";
import { BackButton } from "~/components/ui/back-button";
import { useGoBack } from "~/hooks/use-go-back";
import { ReportsDateProvider } from "~/contexts/reports-date-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "~/components/ui/sidebar";
import { useEffect, useState, useRef } from "react";
import { ModeToggle } from "~/components/mode-toggle";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn, isAuthenticated } from "~/lib/utils";
import { Logout } from "~/components/logout";
import { SlidingContainer } from "~/components/sliding-container";
import { useNavigation } from "~/contexts/navigation-context";
import { AttendanceSyncProvider } from "~/components/attendance-sync-provider";
import { prefetchAllData, type PrefetchProgress } from "~/lib/prefetch-data";
import { resetTimestampCache } from "~/lib/sync-manager";
import { toast } from "sonner";
import { WifiOff, Wifi, CheckCircle2 } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { GlobalSearchBar } from "~/components/global-search-bar";

export default function MainLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // Reset the in-memory timestamp cache on every route change so the next
  // data fetch always checks the server for freshness.
  useEffect(() => {
    resetTimestampCache();
  }, [location.pathname]);
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  // Eagerly prefetch all API data in the background so every page works
  // offline — even pages the user hasn't visited yet.
  // Only run when the user is authenticated to avoid 401 errors on
  // /sync/timestamps before the login redirect completes.
  useEffect(() => {
    if (isAuthenticated()) {
      runPrefetchWithToast(false);
    }
  }, []);

  // Show a sonner toast when the device goes offline / comes back online.
  useEffect(() => {
    function handleOffline() {
      toast.error("لا يوجد اتصال بالإنترنت", {
        id: "offline-toast",
        duration: Infinity,
        icon: <WifiOff className="size-5" />,
        description: "سيتم استخدام البيانات المحفوظة مؤقتًا",
      });
    }

    function handleOnline() {
      toast.dismiss("offline-toast");
      toast.success("تم استعادة الاتصال بالإنترنت", {
        id: "online-toast",
        duration: 3000,
        icon: <Wifi className="size-5" />,
      });
      // Re-prefetch fresh data now that we're back online
      runPrefetchWithToast(true);
    }

    // Check current state on mount
    if (!navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <AttendanceSyncProvider>
      <SearchProvider>
        <ReportsDateProvider>
          <div className="px-4 pt-3 pb-16 md:px-2 md:py-2">
            {isMobile ? <BottomNavBarLayout /> : <SidebarLayout />}
          </div>
        </ReportsDateProvider>
      </SearchProvider>
    </AttendanceSyncProvider>
  );
}

/**
 * Run prefetchAllData with an attached sonner toast showing progress.
 */
function runPrefetchWithToast(force: boolean) {
  let toastId: string | number | null = null;
  const startTime = Date.now();

  prefetchAllData(force, (progress: PrefetchProgress) => {
    // total ≤ 1 means no extended work or a status-only update
    if (progress.total <= 1) {
      if (toastId) {
        toast.dismiss(toastId);
        toastId = null;
      }
      return;
    }

    const pct = Math.round((progress.loaded / progress.total) * 100);
    const done = progress.loaded >= progress.total;

    if (done) {
      if (toastId) {
        toast.dismiss(toastId);
        toastId = null;
      }
      const elapsed = Date.now() - startTime;
      if (elapsed > 1000) {
        toast.success("جميع البيانات جاهزة للاستخدام دون اتصال", {
          id: "prefetch-done-toast",
          duration: 4000,
          icon: <CheckCircle2 className="size-5" />,
        });
      }
    } else if (!toastId) {
      toastId = toast(
        <div dir="rtl" className="w-full">
          <p className="text-sm font-medium mb-2">{progress.phase}</p>
          <Progress value={pct} className="w-full" />
          <p className="text-xs text-muted-foreground mt-1">
            {progress.loaded}/{progress.total} — {pct}%
          </p>
        </div>,
        { duration: Infinity },
      );
    } else {
      toast(
        <div dir="rtl" className="w-full">
          <p className="text-sm font-medium mb-2">{progress.phase}</p>
          <Progress value={pct} className="w-full" />
          <p className="text-xs text-muted-foreground mt-1">
            {progress.loaded}/{progress.total} — {pct}%
          </p>
        </div>,
        { id: toastId },
      );
    }
  });
}

function SidebarLayout() {
  const location = useLocation();
  const goBack = useGoBack();
  const showBackButton = location.pathname !== "/";
  const navigation = useNavigation();
  const items = navigation.getSidebarItems();
  const [pinned, setPinned] = useState(localStorage.getItem("sidebar_state") === "true");
  const [hovering, setHovering] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem("sidebar_state", pinned ? "true" : "false");
  }, [pinned]);

  const open = pinned || hovering;

  function handleOpenChange() {
    setPinned(prev => !prev);
  }

  function handleMouseEnter() {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }
    if (!pinned) setHovering(true);
  }

  function handleMouseLeave() {
    hoverTimeoutRef.current = setTimeout(() => {
      setHovering(false);
    }, 300);
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <Sidebar
        side="right"
        collapsible="icon"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end>
                        <item.icon />
                        <span className="text-base">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {open ? (
            <div className="flex flex-row gap-3">
              <Logout className="grow" />
              <ModeToggle />
            </div>) : <ModeToggle className="size-8" />
          }
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center gap-2 mb-4">
          <SidebarTrigger />
          {showBackButton && <BackButton onClick={goBack} />}
          <div className="flex-1 flex justify-center">
            <GlobalSearchBar className="w-full max-w-md" />
          </div>
        </div>
        {useRRNavigation().state === "loading" ? <NavigationSkeleton /> : <Outlet />}
      </SidebarInset>
    </SidebarProvider>
  );
}

function BottomNavBarLayout() {
  const location = useLocation();
  const goBack = useGoBack();
  const showBackButton = location.pathname !== "/";
  const navigation = useNavigation();
  const items = navigation.getBottomNavItems();
  const isPageLoading = useRRNavigation().state === "loading";

  return (
    <>
      <main className="pb-14">
        <div className="flex items-center gap-3 mb-4">
          {showBackButton && <BackButton onClick={goBack} />}
          <div className="flex-1">
            <GlobalSearchBar />
          </div>
        </div>
        <SlidingContainer className="h-full">
          {isPageLoading ? <NavigationSkeleton /> : <Outlet />}
        </SlidingContainer>
      </main>
      <div className="bottom-nav-bar flex rtl:flex-row-reverse flex-row justify-between fixed bottom-0 left-0 right-0 w-dvw h-14 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-sidebar z-50">
        {items.map((item) => (
          <NavLink key={item.title} to={item.url} className="width-fit h-full pb-3 pt-1.5 block">
              {({ isActive }) => (
                <div className={cn("flex items-center justify-center min-w-fit w-13 h-full rounded", isActive? "bg-primary": '')}>
                  <item.icon className={isActive? 'text-sidebar dark:text-white' : ''} fill={isActive ? "currentColor" : "none"} />
                </div>
              )}
            </NavLink>
        ))}
      </div>
    </>
  );
}

function NavigationSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      
      {/* Filter / Search Bar Skeleton */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="border border-border/50 rounded-2xl p-5 flex flex-col gap-4 bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex justify-between items-center mt-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        <div className="border border-border/50 rounded-2xl p-5 flex flex-col gap-4 bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <div className="flex justify-between items-center mt-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        <div className="border border-border/50 rounded-2xl p-5 flex flex-col gap-4 bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-between items-center mt-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="flex flex-col gap-3 mt-4">
        <Skeleton className="h-6 w-48" />
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <div className="bg-muted/40 p-4 border-b border-border/50 flex justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="p-4 flex flex-col gap-3.5">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
