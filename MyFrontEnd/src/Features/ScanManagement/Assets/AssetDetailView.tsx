import { Badge } from "@/components/Customized/badge";
import type { Asset } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function AssetDetailView({ asset }: { asset: Asset }) {
  return (
    <DetailCard>
      <DetailCard.Header>
        <h3 className="font-semibold text-xl tracking-tight">{asset.name}</h3>
        <Badge variant={"outline"} className="uppercase">
          {asset.value}
        </Badge>
      </DetailCard.Header>

      <DetailCard.Section>
        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Type:</span>
          <Badge variant="outline" className="capitalize text-sm">
            {asset.type}
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Added Date:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{asset.addedDate ? format(parseISO(asset.addedDate), "PPP") : "Never"}</span>
          </Badge>
        </DetailCard.Row>

        <DetailCard.Row>
          <span className="text-muted-foreground text-sm">Last Scan:</span>
          <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent">
            <Calendar className="size-4" />
            <span className="text-sm">{asset.lastScan ? format(parseISO(asset.lastScan), "PPP") : "Never"}</span>
          </Badge>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Section className="pt-4 border-t">
        <DetailCard.Row className="items-baseline">
          <span className="text-muted-foreground text-sm">Tags:</span>
          <div className="flex flex-wrap gap-2 justify-end max-w-62.5 ">
            {asset.tags.map((tag) => (
              <Badge key={tag} theme="informative">
                {tag}
              </Badge>
            ))}
          </div>
        </DetailCard.Row>
      </DetailCard.Section>

      <DetailCard.Footer>
        Information was retrieved from the latest scan on {asset.lastScan ? format(parseISO(asset.lastScan), "PPP") : "Never"}
      </DetailCard.Footer>
    </DetailCard>
  );
}
