import { createContext, useContext } from "react";
import { HomeIcon, MenuIcon, CalendarCheck, BarChart3, type LucideProps } from "lucide-react";

export interface NavigationItem {
  title: string;
  url: string;
  icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  showInSidebar?: boolean;
  showInBottomNav?: boolean;
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
    title: "زيادات", 
    url: "/more", 
    icon: MenuIcon,
    showInSidebar: false,
    showInBottomNav: true
  },
];

const navigationConfig: NavigationConfig = {
  items: navigationItems,
  getRouteOrder: () => navigationItems.map(item => item.url),
  getSidebarItems: () => navigationItems.filter(item => item.showInSidebar !== false),
  getBottomNavItems: () => navigationItems.filter(item => item.showInBottomNav !== false),
};

const NavigationContext = createContext<NavigationConfig>(navigationConfig);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContext.Provider value={navigationConfig}>
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