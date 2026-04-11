"use client";

import type { Asset } from "@/types";
import { MobileCard } from "@/components/layout/MobileCard";
import { SeverityBadge } from "@/components/layout/SeverityBadge";
import { formatRelativeTime } from "@/lib/utils";
import { Globe, Server, Link, Network, Calendar } from "lucide-react";
import AssetRowActions from "@/Features/assets/AssetRowActions";

const typeConfig = {
  DOMAIN: { icon: Globe, label: "Domain", theme: "informative" as const },
  IP: { icon: Server, label: "IP Address", theme: "outlineSecondary" as const },
  URL: { icon: Link, label: "URL", theme: "low" as const },
  CIDR: { icon: Network, label: "CIDR Range", theme: "high" as const },
};

export default function AssetMobileCard({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  const Icon = config?.icon || Globe;

  return (
    <MobileCard className="w-full max-w-full">
      <MobileCard.Header>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/30 border border-border/30 text-muted-foreground">
            <Icon className="size-3.5" />
          </div>
          <h4
            className="font-bold text-lg tracking-tight leading-none truncate max-w-[200px]"
            title={asset.name}
          >
            {asset.name}
          </h4>
        </div>
        <SeverityBadge
          theme={config?.theme || "none"}
          className="uppercase text-[10px] font-black"
        >
          {config?.label || asset.type}
        </SeverityBadge>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Value:
          </span>
          <span className="truncate max-w-[200px] px-2 py-0.5 bg-muted/40 border border-border/50 text-[10px] font-mono text-muted-foreground rounded-sm">
            {asset.value}
          </span>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Added:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {formatRelativeTime(asset.createdAt)}
            </span>
          </div>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-xs text-muted-foreground font-medium shrink-0">
            Updated:
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-xs font-bold truncate">
              {formatRelativeTime(asset.updatedAt)}
            </span>
          </div>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <AssetRowActions asset={asset} />
      </MobileCard.Footer>
    </MobileCard>
  );
}


