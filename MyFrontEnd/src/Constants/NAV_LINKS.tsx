import {
  LayoutDashboard,
  Globe,
  Network,
  Activity,
  AlertTriangle,
  CheckCircle,
  Database,
  Calendar,
  Users,
  History,
} from "lucide-react";

export const NAV_LINKS = [
  {
    group: "Dashboard",
    items: [{ label: "Overview", link: "/overview", icon: LayoutDashboard }],
  },
  {
    group: "Attack Surface",
    items: [
      { label: "Domains", link: "/domains", icon: Globe },
      { label: "IPs", link: "/ips", icon: Network },
      { label: "Ports", link: "/ports", icon: Activity },
    ],
  },
  {
    group: "Vulnerabilities",
    items: [
      { label: "Open", link: "/open", icon: AlertTriangle },
      { label: "Fixed", link: "/fixed", icon: CheckCircle },
    ],
  },
  {
    group: "Scan Management",
    items: [
      { label: "Assets", link: "/assets", icon: Database },
      { label: "Schedule", link: "/schedule", icon: Calendar },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Organization", link: "/organization", icon: Users },
      { label: "Activity", link: "/history", icon: History },
    ],
  },
];
