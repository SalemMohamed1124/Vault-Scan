import { DataTable } from "@/components/DataTable/DataTable";
import useIps from "./useIps";
import { IpsColumns } from "./IpsColumns";

function IpsTable() {
  const { ips = [], isPending, error } = useIps();
  return <DataTable tableName="IpsTable" data={ips} columns={IpsColumns} isLoading={isPending} error={error} />;
}

export default IpsTable;
