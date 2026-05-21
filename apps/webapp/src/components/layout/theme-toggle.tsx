"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useThemePreference } from "@/hooks/use-theme-preference"
import { ThemePreference } from "@/lib/types"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const applyTheme = React.useCallback(
    (theme: ThemePreference) => setTheme(theme),
    [setTheme],
  )
  const { persistTheme } = useThemePreference(applyTheme)

  React.useEffect(() => setMounted(true), [])

  const handleToggle = () => {
    const next: ThemePreference = resolvedTheme === "dark" ? "light" : "dark"
    void persistTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={handleToggle}
      disabled={!mounted}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
