import IpsTable from "@/Features/AttackSurface/IPs/IpsTable";
import IpSummary from "@/Features/AttackSurface/IPs/IpSummary";

function IPs() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">IP Addresses</h1>
        <h2 className="text-muted-foreground ">
          Monitor and analyze your IP assets
        </h2>
      </div>
      <div>
        <IpSummary />
      </div>

      <div className="w-full">
        <IpsTable />
      </div>
    </div>
  );
}
export default IPs;
