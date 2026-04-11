import { DataTable } from "@/components/DataTable/DataTable";
import { DomainColumns } from "./DomainColumns";
import useDomains from "./useDomains";

function DomainsTable() {
  const { domains = [], isPending: loadingDomains, error } = useDomains();
  return <DataTable tableName="DomainsTable" data={domains} columns={DomainColumns} isLoading={loadingDomains} error={error} />;
}
export default DomainsTable;
