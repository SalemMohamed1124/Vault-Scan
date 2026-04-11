import type { ColumnDef } from "@tanstack/react-table";
import type { Domain, Severity } from "@/Types/data-types";
import { Calendar, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { DataTableColumnHeader } from "../../../components/DataTable/DataTableColumnHeader";
import DomainMobileCard from "./DomainMobileCard";
import DomainRowActions from "./DomainRowActions";
import { Badge } from "@/components/Customized/badge";
import { facetedFilter, sortSeverity } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export const DomainColumns: ColumnDef<Domain>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <DomainMobileCard domain={row.original} />,
  },
  {
    accessorKey: "value",
    meta: { search: { placeholder: "Search by domain" } },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Domain" />,
    cell: ({ row }) => <div className="font-medium truncate ">{row.getValue("value") as string}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { className: "capitalize", filter: true },
    filterFn: facetedFilter,
  },
  {
    accessorKey: "ssl",
    header: "SSL",
    meta: { className: "hidden xl:table-cell", filter: true },
    filterFn: facetedFilter,

    cell: ({ row }) => {
      const ssl = row.getValue("ssl") as Domain["ssl"];
      const sslTheme = ssl === "valid" ? "none" : ssl === "expired" ? "critical" : "high";
      return (
        <Badge theme={sslTheme} className="*:size-4 border-none bg-transparent p-0 space-x-1 ">
          {ssl === "valid" ? <ShieldCheck /> : ssl === "expired" ? <ShieldX /> : <ShieldAlert />}
          <span>{ssl}</span>
        </Badge>
      );
    },
  },

  {
    accessorKey: "severity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
    sortingFn: (rowA, rowB) => sortSeverity(rowA.original.severity, rowB.original.severity),
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const severity = row.getValue("severity") as Severity;

      return <Badge theme={severity}>{severity}</Badge>;
    },
    filterFn: facetedFilter,
  },
  {
    accessorKey: "vulnerabilities",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vulnerabilities" />,
    meta: { sort: true },
    cell: ({ row }) => <span>{row.getValue("vulnerabilities") as number}</span>,
  },
  {
    accessorKey: "createdDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created Date" />,
    meta: { sort: true },
    sortingFn: "datetime",
    cell: ({ row }) => {
      const date = row.getValue("createdDate") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center  border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{format(parseISO(date), "PPP")}</span>
        </Badge>
      );
    },
  },

  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    meta: { className: "w-0 text-right" },
    cell: ({ row }) => {
      const domain = row.original;

      return <DomainRowActions domain={domain} />;
    },
  },
];
