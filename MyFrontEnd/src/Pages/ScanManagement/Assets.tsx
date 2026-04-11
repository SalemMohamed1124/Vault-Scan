import AssetsTable from "@/Features/ScanManagement/Assets/AssetsTable";
import AssetSummary from "@/Features/ScanManagement/Assets/AssetSummary";

function Assets() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Assets</h1>
        <h2 className="text-muted-foreground ">Monitor and manage your assets</h2>
      </div>
      <div className="w-full">
        <AssetSummary />
      </div>

      <div className="w-full">
        <AssetsTable />
      </div>
    </div>
  );
}
export default Assets;
