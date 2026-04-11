import {
  LayoutDashboard,
  Database,
  Radar,
  AlertTriangle,
  Calendar,
  FileText,
  Bell,
  Settings,
} from "lucide-react";

export const NAV_LINKS = [
  {
    group: null,
    items: [{ label: "Overview", link: "/overview", icon: LayoutDashboard }],
  },
  {
    group: "Attack Surface",
    items: [
      { label: "Assets", link: "/assets", icon: Database },
      { label: "Scans", link: "/scans", icon: Radar },
      { label: "Findings", link: "/findings", icon: AlertTriangle },
    ],
  },
  {
    group: "Scan Management",
    items: [
      { label: "Schedules", link: "/schedules", icon: Calendar },
      { label: "Reports", link: "/reports", icon: FileText },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Notifications", link: "/notifications", icon: Bell },
      { label: "Workspace Settings", link: "/settings", icon: Settings },
    ],
  },
];
