"use client";

import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

import { NotificationsBell } from "@/components/layout/notifications-bell";
import { Button } from "@/components/ui/button";
import { usePlatformStatus } from "@/lib/api/use-platform-status";
import { useCurrentUser, useLogout } from "@/lib/api/use-auth";
import { useSidebarStore } from "@/lib/stores/sidebar-store";

export function Topbar() {
  const router = useRouter();
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const { resolvedTheme, setTheme } = useTheme();
  const { data, isError } = usePlatformStatus();
  const { data: currentUser } = useCurrentUser();
  const logoutMutation = useLogout();

  const statusLabel = isError ? "API unreachable" : data ? "Operational" : "Checking…";
  const statusColor = isError ? "bg-destructive" : data ? "bg-emerald-500" : "bg-muted-foreground";

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    router.replace("/login");
  }

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
      <div className="flex items-center gap-1">
        {currentUser && (
          <span className="text-muted-foreground mr-2 hidden text-xs sm:inline">
            {currentUser.user.email} · {currentUser.user.role}
          </span>
        )}
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          suppressHydrationWarning
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Log out"
          disabled={logoutMutation.isPending}
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
