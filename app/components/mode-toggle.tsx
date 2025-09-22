import { Moon, Sun } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useTheme } from "~/components/theme-provider";
import { cn } from "~/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
  const themeProvider = useTheme()

  return (
    <Button size="icon" className={cn("p-1", className)} onClick={() => { themeProvider.theme === "light" ? themeProvider.setTheme("dark") : themeProvider.setTheme("light") }}>
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}