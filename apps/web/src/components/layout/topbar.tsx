"use client";

import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { usePlatformStatus } from "@/lib/api/use-platform-status";
import { useSidebarStore } from "@/lib/stores/sidebar-store";

export function Topbar() {
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const { resolvedTheme, setTheme } = useTheme();
  const { data, isError } = usePlatformStatus();

  const statusLabel = isError ? "API unreachable" : data ? "Operational" : "Checking…";
  const statusColor = isError ? "bg-destructive" : data ? "bg-emerald-500" : "bg-muted-foreground";

  return (
    <header className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="size-4" />
        </Button>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className={`size-2 rounded-full ${statusColor}`} aria-hidden />
          <span>{statusLabel}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        suppressHydrationWarning
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  );
}
