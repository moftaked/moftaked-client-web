import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"
import { useState } from "react"

const ANIMATION_DURATION = 600;
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-w-fit",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80 shadow-lg",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

import { Loader2 } from "lucide-react"

function Button({
  className,
  variant,
  size,
  asChild = false,
  onClick,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const Comp = asChild ? Slot : "button"

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), ANIMATION_DURATION);
    
    if (onClick) {
      onClick(event)
    }
  }

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        "ripple-effect",
        isAnimating && "ripple-active",
        loading && "relative text-transparent! select-none pointer-events-none"
      )}
      onClick={asChild ? onClick : handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center text-current">
          <Loader2 className="animate-spin size-5" />
        </span>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
