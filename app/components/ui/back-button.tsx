import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "~/lib/utils";

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  label?: string;
}

export const BackButton = React.forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ className, asChild = false, label = "رجوع", children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center gap-0.5 text-base font-normal text-foreground bg-transparent border-0 outline-none transition-opacity cursor-pointer hover:bg-transparent hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring active:opacity-40 select-none py-1.5 px-2 -mx-2 h-10 w-fit shrink-0",
          className
        )}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            <ChevronRight className="size-6 shrink-0 stroke-[2.5]" />
            <span className="font-medium text-base leading-none pb-0.5">{label}</span>
          </>
        )}
      </Comp>
    );
  }
);

BackButton.displayName = "BackButton";
