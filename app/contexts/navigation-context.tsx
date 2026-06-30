import { createContext, useContext } from "react";
import { HomeIcon, MenuIcon, CalendarCheck, BarChart3, ShieldCheck, School, CalendarDays, Map, Settings, type LucideProps } from "lucide-react";
import { isAdmin, isManager } from "~/lib/utils";

export interface NavigationItem {
  title: string;
  url: string;
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  showInSidebar?: boolean;
  showInBottomNav?: boolean;
  /** When true, only shown if the user is an admin */
  adminOnly?: boolean;
  /** When true, only shown if the user is a manager or admin */
  managerOnly?: boolean;
}

export interface NavigationConfig {
  items: NavigationItem[];
  getRouteOrder: () => string[];
  getSidebarItems: () => NavigationItem[];
  getBottomNavItems: () => NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  { 
    title: "البيت", 
    url: "/", 
    icon: HomeIcon,
    showInSidebar: true,
    showInBottomNav: true
  },
  { 
    title: "الحضور", 
    url: "/attendance", 
    icon: CalendarCheck,
    showInSidebar: true,
    showInBottomNav: true
  },
  { 
    title: "التقارير", 
    url: "/reports", 
    icon: BarChart3,
    showInSidebar: true,
    showInBottomNav: true
  },
  { 
    title: "الحسابات", 
    url: "/admin/accounts", 
    icon: ShieldCheck,
    showInSidebar: true,
    showInBottomNav: false,
    adminOnly: true,
  },
  { 
    title: "الفصول", 
    url: "/admin/classes", 
    icon: School,
    showInSidebar: true,
    showInBottomNav: false,
    adminOnly: true,
  },
  { 
    title: "إدارة الغياب", 
    url: "/admin/events", 
    icon: CalendarDays,
    showInSidebar: true,
    showInBottomNav: false,
    adminOnly: true,
  },
  { 
    title: "إدارة المناطق", 
    url: "/admin/districts", 
    icon: Map,
    showInSidebar: true,
    showInBottomNav: false,
    managerOnly: true,
  },
  { 
    title: "زيادات", 
    url: "/more", 
    icon: MenuIcon,
    showInSidebar: false,
    showInBottomNav: true
  },
  { 
    title: "الإعدادات", 
    url: "/settings", 
    icon: Settings,
    showInSidebar: true,
    showInBottomNav: false
  },
];

function filterByRole(items: NavigationItem[]): NavigationItem[] {
  const userIsAdmin = isAdmin();
  const userIsManager = isManager();
  return items.filter(item => {
    if (item.adminOnly && !userIsAdmin) return false;
    if (item.managerOnly && !userIsManager) return false;
    return true;
  });
}

function buildNavigationConfig(): NavigationConfig {
  return {
    items: navigationItems,
    getRouteOrder: () => navigationItems.map(item => item.url),
    getSidebarItems: () =>
      filterByRole(navigationItems).filter(item => item.showInSidebar !== false),
    getBottomNavItems: () =>
      filterByRole(navigationItems).filter(item => item.showInBottomNav !== false),
  };
}

const NavigationContext = createContext<NavigationConfig>(buildNavigationConfig());

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // Rebuild the config on every render so role checks re-evaluate after login
  // (isManager() reads from localStorage which may change between renders).
  const config = buildNavigationConfig();

  return (
    <NavigationContext.Provider value={config}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}
