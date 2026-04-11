import { DataTable } from "@/components/DataTable/DataTable";
import useVulnerabilities from "./useVulnerabilities";
import { VulnerabilitiesColumns } from "./VulnerabilitiesColumns";

function VulnerabilitiesTable() {
  const { vulnerabilities = [], isPending: loadingVulnerabilities, error } = useVulnerabilities();

  const openVulnerabilities = vulnerabilities.filter((v) => v.status === "open");
  return (
    <DataTable
      tableName="VulnerabilitiesTable"
      data={openVulnerabilities}
      columns={VulnerabilitiesColumns}
      isLoading={loadingVulnerabilities}
      error={error}
    />
  );
}

export default VulnerabilitiesTable;
