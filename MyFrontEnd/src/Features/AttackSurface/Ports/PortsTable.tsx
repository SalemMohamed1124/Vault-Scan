import { DataTable } from "@/components/DataTable/DataTable";
import usePorts from "./usePorts";
import { PortsColumns } from "./PortsColumns";

function PortsTable() {
  const { ports = [], isPending: loadingPorts, error } = usePorts();
  return <DataTable tableName="PortsTable" data={ports} columns={PortsColumns} isLoading={loadingPorts} error={error} />;
}

export default PortsTable;
