import { Summary } from "@/components/Customized/summary";
import useAssets from "./useAssets";
import { Globe, Server, Shield } from "lucide-react";

export default function AssetSummary() {
  const { assets } = useAssets();

  if (!assets) return null;

  return (
    <Summary data={assets}>
      <Summary.Card
        label="Total Assets"
        sublabel="All monitored assets"
        icon={<Shield className="size-4" />}
        counts={assets.length}
        variant="informative"
      />
      <Summary.Card
        label="Type"
        sublabel="Domains"
        icon={<Globe className="size-4" />}
        find={{ column: "type", value: "domain" }}
        variant="none"
      />
      <Summary.Card
        label="Type"
        sublabel="IP Addresses"
        icon={<Server className="size-4" />}
        find={{ column: "type", value: "ip" }}
        variant="none"
      />
    </Summary>
  );
}
