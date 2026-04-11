"use client";

import { useAssetsStats } from "./useAssets";
import { Summary } from "@/components/layout/Summary";
import { Shield, Globe, Server, AlertTriangle } from "lucide-react";

export default function AssetSummary() {
  const { stats, isPending: isLoading } = useAssetsStats();

  return (
    <Summary data={[]}>
      <Summary.Card
        label="Total Assets"
        variant="success"
        icon={<Shield className="size-4" />}
        counts={stats?.total ?? (isLoading ? "..." : 0)}
        sublabel="MONITORED ASSETS"
      />
      <Summary.Card
        label="Type"
        variant="none"
        icon={<Globe className="size-4" />}
        counts={stats?.byType.DOMAIN ?? (isLoading ? "..." : 0)}
        sublabel="DOMAINS"
      />
      <Summary.Card
        label="Type"
        variant="none"
        icon={<Server className="size-4" />}
        counts={stats?.byType.IP ?? (isLoading ? "..." : 0)}
        sublabel="IP ADDRESSES"
      />
      <Summary.Card
        label="Risk Level"
        variant={
          stats?.criticalCount && stats.criticalCount > 0 ? "critical" : "high"
        }
        icon={<AlertTriangle className="size-4" />}
        counts={stats?.totalVulnerabilities ?? (isLoading ? "..." : 0)}
        sublabel={
          stats?.criticalCount && stats.criticalCount > 0
            ? "CRITICAL_ISSUES"
            : "VULNS_FOUND"
        }
      />
    </Summary>
  );
}

