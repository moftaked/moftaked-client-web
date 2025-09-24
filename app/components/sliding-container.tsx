import { useLocation } from "react-router";
import { useNavigationDirection } from "~/hooks/use-navigation-direction";
import { cn } from "~/lib/utils";

interface SlidingContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function SlidingContainer({ children, className }: SlidingContainerProps) {
  const location = useLocation();
  const direction = useNavigationDirection();
  
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        key={location.pathname}
        className={cn(
          "w-full transition-transform duration-300 ease-in-out",
          direction === "left" && "animate-slide-in-left",
          direction === "right" && "animate-slide-in-right"
        )}
      >
        {children}
      </div>
    </div>
  );
}