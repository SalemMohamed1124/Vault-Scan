import { SeverityBadge } from "@/components/layout/SeverityBadge";
import type { Asset } from "@/types";
import { DetailCard } from "@/components/layout/DetailCard";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function AssetDetailView({ asset }: { asset: Asset }) {
  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{asset.name}</h3>
        <SeverityBadge variant={"outline"} className="uppercase">
          {asset.value}
        </SeverityBadge>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Asset ID:</span>
          <span
            className="text-sm font-mono truncate max-w-[200px]"
            title={asset.id}
          >
            {asset.id}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Type:</span>
          <SeverityBadge variant="outline" className="capitalize text-sm">
            {asset.type}
          </SeverityBadge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Org ID:</span>
          <span
            className="text-sm font-mono truncate max-w-[200px]"
            title={asset.orgId}
          >
            {asset.orgId}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Created By:</span>
          <span
            className="text-sm truncate max-w-[200px]"
            title={asset.createdBy || "System"}
          >
            {asset.createdBy || "System"}
          </span>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Added Date:</span>
          <SeverityBadge
            variant="outline"
            className="flex gap-2 p-0 w-fit items-center border-none bg-transparent"
          >
            <Calendar className="size-4" />
            <span className="text-sm">
              {asset.createdAt ? format(parseISO(asset.createdAt), "PPP") : "—"}
            </span>
          </SeverityBadge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Last Updated:</span>
          <SeverityBadge
            variant="outline"
            className="flex gap-2 p-0 w-fit items-center border-none bg-transparent"
          >
            <Calendar className="size-4" />
            <span className="text-sm">
              {asset.updatedAt ? format(parseISO(asset.updatedAt), "PPP") : "—"}
            </span>
          </SeverityBadge>
        </DetailCard.Row>
      </DetailCard.Section>
    </DetailCard>
  );
}


