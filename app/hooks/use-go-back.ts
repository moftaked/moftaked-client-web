import { useNavigate, useLocation } from "react-router";

export function getFallbackPath(pathname: string): string {
  if (pathname.startsWith("/attendance/")) {
    const parts = pathname.split("/");
    if (parts.length > 4 && parts[3] === "event") {
      return `/attendance/${parts[2]}`;
    }
    return "/attendance";
  }
  
  if (pathname.startsWith("/reports/")) {
    const parts = pathname.split("/");
    if (pathname.startsWith("/reports/class/")) {
      if (parts.length > 5 && parts[4] === "event") {
        return `/reports/class/${parts[3]}`;
      }
      return "/reports";
    }
    if (pathname.startsWith("/reports/person/")) {
      return "/reports";
    }
    return "/reports";
  }

  return "/";
}

export function useGoBack(fallback?: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key && location.key !== "default") {
      navigate(-1);
    } else {
      const fb = fallback ?? getFallbackPath(location.pathname);
      navigate(fb, { replace: true });
    }
  };
}
