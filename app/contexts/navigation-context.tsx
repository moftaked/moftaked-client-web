import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { HomeIcon, MenuIcon, CalendarCheck, BarChart3, ShieldCheck, School, CalendarDays, Map, Settings, Lightbulb, ClipboardList, type LucideProps } from "lucide-react";
import { isAdmin, isManager } from "~/lib/utils";

function hasEquipmentAccess(): boolean {
  return localStorage.getItem("hasEquipmentAccess") === "true";
}

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
  /** When true, shown if admin or has equipment access */
  equipmentOnly?: boolean;
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
    title: "الحجوزات",
    url: "/reservations",
    icon: ClipboardList,
    showInSidebar: true,
    showInBottomNav: true,
  },
  {
    title: "وسائل الإيضاح",
    url: "/equipment",
    icon: Lightbulb,
    showInSidebar: true,
    showInBottomNav: true,
    equipmentOnly: true,
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
  const userHasEquipment = hasEquipmentAccess();
  return items.filter(item => {
    if (item.adminOnly && !userIsAdmin) return false;
    if (item.managerOnly && !userIsManager) return false;
    if (item.equipmentOnly && !userIsAdmin && !userHasEquipment) return false;
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
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const handler = () => setRevision((r) => r + 1);
    window.addEventListener("equipment-access-changed", handler);
    return () => window.removeEventListener("equipment-access-changed", handler);
  }, []);

  const config = useMemo(() => buildNavigationConfig(), [revision]);

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
