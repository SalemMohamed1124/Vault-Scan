import { DataTable } from "@/components/DataTable/DataTable";
import useScans from "./useScans";
import { ScanColumns } from "./ScanColumns";

function ScansTable() {
  const { scans = [], isPending, error } = useScans();
  return <DataTable tableName="ScansTable" data={scans || []} columns={ScanColumns} isLoading={isPending} error={error} />;
}

export default ScansTable;
