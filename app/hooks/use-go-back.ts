import { useNavigate, useLocation } from "react-router";

export function useGoBack(fallback: string = "/") {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key && location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };
}
