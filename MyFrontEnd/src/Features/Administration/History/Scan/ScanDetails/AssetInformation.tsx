import { type Asset } from "@/Types/data-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Customized/card";
import { Badge } from "@/components/Customized/badge";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { Calendar, Globe, Server, Tag, Hash } from "lucide-react";

export default function AssetInformation({ asset }: { asset: Asset }) {
  const isDomain = asset.type === "domain";

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isDomain ? "bg-blue-500/10" : "bg-emerald-500/10"}`}>
            {isDomain ? <Globe className="size-5 text-blue-500" /> : <Server className="size-5 text-emerald-500" />}
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-xl font-bold tracking-tight">{asset.value}</CardTitle>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{asset.type} Asset</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="flex flex-wrap gap-y-6 gap-x-12">
          <DataPoint icon={<Hash className="size-4 text-muted-foreground" />} label="Internal Name" value={asset.name} />

          <DataPoint
            icon={<Tag className="size-4 text-muted-foreground" />}
            label="Tags"
            value={
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {asset.tags.map((tag) => (
                  <Badge key={tag} theme="outlineSecondary" className="px-2 py-0 text-xs h-5">
                    {tag}
                  </Badge>
                ))}
              </div>
            }
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-blue-400/70" />
              <span className="font-bold uppercase text-xs tracking-widest">Inventory Added</span>
            </div>
            <p className="font-medium text-foreground truncate pl-6 text-sm">{format(parseISO(asset.addedDate), "PPP")}</p>
          </div>

          {asset.lastScan && (
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-emerald-400/70" />
                <span className="font-bold uppercase text-xs tracking-widest">Last Scanned</span>
              </div>
              <p className="font-medium text-foreground truncate pl-6 text-sm">{format(parseISO(asset.lastScan), "PPP")}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DataPoint({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string | number | React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-max">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className={`${className} font-semibold transition-colors group-hover:text-primary pl-6 text-sm`}>{value}</div>
    </div>
  );
}
