import AssetSummary from "@/Features/assets/AssetSummary";
import AssetsTable from "@/Features/assets/AssetsTable";

export default function AssetsPage() {
  return (
    <div className="w-full space-y-2">
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
