import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  Globe2,
  LayoutDashboard,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/threat-intel", label: "Threat Intelligence", icon: Globe2 },
  { href: "/assets", label: "Asset Inventory", icon: Server },
  { href: "/vulnerabilities", label: "Vulnerabilities", icon: ShieldQuestion },
  { href: "/hunting", label: "Threat Hunting", icon: Activity },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileText },
];
