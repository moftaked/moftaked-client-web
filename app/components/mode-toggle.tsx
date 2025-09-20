import { Moon, Sun } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useTheme } from "~/components/theme-provider";

export function ModeToggle({ className }: { className?: string }) {
  const themeProvider = useTheme()

  return (
    <div className={`lg:p-4 ${className}`}>
      <Button size="icon" className="pr-6 pl-3 w-fit rounded-r-none lg:rounded-md lg:size-9 lg:p-0" onClick={() => { themeProvider.theme === "light" ? themeProvider.setTheme("dark") : themeProvider.setTheme("light") }}>
        <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  )
}