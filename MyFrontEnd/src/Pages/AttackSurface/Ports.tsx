import PortsTable from "@/Features/AttackSurface/Ports/PortsTable";
import PortSummary from "@/Features/AttackSurface/Ports/PortSummary";

function Ports() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold"> Ports</h1>
        <h2 className="text-muted-foreground ">
          Monitor and analyze your network entry points
        </h2>
      </div>
      <div>
        <PortSummary />
      </div>

      <div>
        <div className="w-full">
          <PortsTable />
        </div>
      </div>
    </div>
  );
}
export default Ports;
