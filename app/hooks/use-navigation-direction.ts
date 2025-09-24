import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useNavigation } from "~/contexts/navigation-context";

export function useNavigationDirection() {
  const location = useLocation();
  const navigation = useNavigation();
  const previousPath = useRef<string | null>(null);
  const direction = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    if (previousPath.current && previousPath.current !== location.pathname) {
      const routeOrder = navigation.getRouteOrder();
      const currentIndex = routeOrder.indexOf(location.pathname);
      const previousIndex = routeOrder.indexOf(previousPath.current);
      
      if (currentIndex !== -1 && previousIndex !== -1) {
        direction.current = currentIndex > previousIndex ? "right" : "left";
      } else {
        direction.current = null;
      }
    }
    
    previousPath.current = location.pathname;
  }, [location.pathname, navigation]);

  return direction.current;
}