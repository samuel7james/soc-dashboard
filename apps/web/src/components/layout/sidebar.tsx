"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/components/layout/nav-items";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSidebarStore((state) => state.collapsed);

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar text-sidebar-foreground hidden shrink-0 flex-col border-r md:flex",
        collapsed ? "w-16" : "w-64",
        "transition-[width] duration-200",
      )}
    >
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <ShieldCheck className="text-primary size-6 shrink-0" aria-hidden />
        {!collapsed && <span className="text-sm font-semibold tracking-tight">SOC Platform</span>}
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
