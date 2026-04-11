import { DataTable } from "@/components/DataTable/DataTable";
import useFixedVulnerabilities from "./useFixedVulnerabilities";
import { VulnerabilitiesFixedColumns } from "./VulnerabilitiesFixedColumns";

function VulnerabilitiesFixedTable() {
  const { fixedVulns = [], isPending: loadingVulnerabilities, error } = useFixedVulnerabilities();

  return (
    <DataTable
      tableName="VulnerabilitiesFixedTable"
      data={fixedVulns}
      columns={VulnerabilitiesFixedColumns}
      isLoading={loadingVulnerabilities}
      error={error}
    />
  );
}

export default VulnerabilitiesFixedTable;
