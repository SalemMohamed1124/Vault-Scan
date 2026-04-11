import { useParams } from "react-router";
import ScanInformation from "@/Features/Administration/History/Scan/ScanDetails/ScanInformation";
import AssetInformation from "@/Features/Administration/History/Scan/ScanDetails/AssetInformation";
import ScanVulnerabilitiesSection from "@/Features/Administration/History/Scan/ScanDetails/ScanVulnerabilitiesSection";
import ScanPortsSection from "@/Features/Administration/History/Scan/ScanDetails/ScanPortsSection";
import useScan from "@/Features/Administration/History/Scan/useScan";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function ScanDetails() {
  const { id } = useParams();
  const { scan, isPending } = useScan(id);
  const navigate = useNavigate();

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  if (!scan) {
    return <div className="flex items-center justify-center h-96">Scan not found</div>;
  }

  const { assetInformation, vulnerabilities, ports } = scan.fullDetails;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Details</h1>
          <p className="text-muted-foreground">Detailed information for scan execution.</p>
        </div>
        <Button onClick={() => navigate(-1)} variant={"ghost"} size={"lg"}>
          <ArrowLeft />
          Back to History
        </Button>
      </div>

      <ScanInformation scan={scan} />

      <AssetInformation asset={assetInformation} />

      {vulnerabilities?.length > 0 && <ScanVulnerabilitiesSection vulnerabilities={vulnerabilities} />}

      {ports && <ScanPortsSection ports={ports} />}
    </div>
  );
}

export default ScanDetails;
