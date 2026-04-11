import type { Asset } from "@/Types/data-types";
import { DataTableColumnHeader } from "../../../components/DataTable/DataTableColumnHeader";
import { facetedFilter } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/Customized/badge";
import AssetRowActions from "./AssetRowActions";
import AssetMobileCard from "./AssetMobileCard";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sortLastScan } from "@/lib/schedule-utils";

export const AssetColumns: ColumnDef<Asset>[] = [
  // Mobile Card Column
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <AssetMobileCard asset={row.original} />,
  },
  // Desktop Columns
  {
    accessorKey: "name",
    header: "Name",
    meta: { search: { placeholder: "Search by name" } },
    cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    filterFn: facetedFilter,
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <Badge variant="outline" className="uppercase">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("value")}</Badge>,
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[];
      return (
        <div className="flex  flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge theme="informative" className="text-center w-fit" key={tag}>
              {tag}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "addedDate",
    sortingFn: "datetime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Added Date" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const addedDate = row.getValue("addedDate") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center  border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{addedDate ? format(parseISO(addedDate), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "lastScan",
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.lastScan, rowB.original.lastScan),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Scan" />,
    meta: { sort: true },
    cell: ({ row }) => {
      const lastScan = row.getValue("lastScan") as string;
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{lastScan ? format(parseISO(lastScan), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <AssetRowActions asset={row.original} />,
  },
];
