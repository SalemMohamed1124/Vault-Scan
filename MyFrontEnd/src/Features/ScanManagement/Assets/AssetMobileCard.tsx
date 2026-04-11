import { MobileCard } from "@/components/Customized/mobile-card";
import type { Asset } from "@/Types/data-types";
import { Badge } from "@/components/Customized/badge";
import AssetRowActions from "./AssetRowActions";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

function AssetMobileCard({ asset }: { asset: Asset }) {
  return (
    <MobileCard>
      <MobileCard.Header>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-lg">{asset.name}</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5">{asset.value}</code>
          </div>
        </div>
      </MobileCard.Header>

      <MobileCard.Content>
        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Type:</span>
          <Badge variant="outline">{asset.type}</Badge>
        </MobileCard.Row>
        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Tags:</span>
          <div className="flex flex-wrap gap-2 justify-end max-w-50">
            {asset.tags.map((tag) => (
              <Badge key={tag} theme="informative">
                {tag}
              </Badge>
            ))}
          </div>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Added Date:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">
              {asset.addedDate ? format(parseISO(asset.addedDate), "PPP") : "Never"}
            </span>
          </Badge>
        </MobileCard.Row>

        <MobileCard.Row>
          <span className="text-muted-foreground font-medium">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-xs text-muted-foreground">
              {asset.lastScan ? format(parseISO(asset.lastScan), "PPP") : "Never"}
            </span>
          </Badge>
        </MobileCard.Row>
      </MobileCard.Content>

      <MobileCard.Footer>
        <AssetRowActions asset={asset} />
      </MobileCard.Footer>
    </MobileCard>
  );
}

export default AssetMobileCard;
