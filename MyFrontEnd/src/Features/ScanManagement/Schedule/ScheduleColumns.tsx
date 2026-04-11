import type { Schedule } from "@/Types/data-types";
import { DataTableColumnHeader } from "../../../components/DataTable/DataTableColumnHeader";
import { facetedFilter } from "@/lib/utils";
import { sortFrequency, sortLastScan, sortNextRunTime } from "@/lib/schedule-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/Customized/badge";
import { Calendar } from "lucide-react";
import ScheduleRowActions from "./ScheduleRowActions";
import { format, parseISO } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import ScheduleMobileCard from "./ScheduleMobileCard";

export const ScheduleColumns: ColumnDef<Schedule>[] = [
  {
    id: "card",
    meta: { hideOnDesktop: true, className: "p-0" },
    cell: ({ row }) => <ScheduleMobileCard schedule={row.original} />,
  },
  {
    accessorKey: "asset",
    header: "Asset",
    meta: {
      search: { placeholder: "Search by asset", searchPath: "value" },
    },
    cell: ({ row }) => {
      const asset = row.getValue("asset") as Schedule["asset"];
      return <div className="truncate ">{asset.value}</div>;
    },
  },
  {
    accessorKey: "scanType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Scan Type" />,
    filterFn: facetedFilter,
    meta: { filter: true, sort: true },
    cell: ({ row }) => {
      const type = row.getValue("scanType") as Schedule["scanType"];
      return (
        <Badge variant="outline" className="uppercase ">
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "frequency",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Frequency" />,
    sortingFn: sortFrequency,
    meta: { sort: true },
    cell: ({ row }) => {
      const frequency = row.getValue("frequency") as Schedule["frequency"];
      let frequencyText = "";
      if (frequency?.mode === "once") {
        frequencyText = "Once";
      } else if (frequency) {
        frequencyText = `Every ${frequency.repeatEvery} ${frequency.repeatUnit}`;
      } else {
        frequencyText = "Not scheduled";
      }

      return (
        <Badge variant="outline" className="capitalize">
          {frequencyText}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    filterFn: facetedFilter,
    meta: { filter: true, sort: true },

    cell: ({ row }) => {
      const status = row.getValue("status") as Schedule["status"];
      const statusTheme =
        status === "active" ? "none" : status === "paused" ? "medium" : status === "running" ? "low" : "outlineSecondary";

      return (
        <Badge theme={statusTheme}>
          {status === "running" ? (
            <div className="flex gap-2 items-center">
              <Spinner />
              <span>90%</span>
            </div>
          ) : (
            status
          )}
        </Badge>
      );
    },
  },
  {
    accessorKey: "nexRunTime",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Next Scan" />,
    sortingFn: sortNextRunTime,
    meta: { sort: true },
    cell: ({ row }) => {
      const nexRunTime = row.getValue("nexRunTime") as Schedule["nexRunTime"];
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center  border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{nexRunTime ? format(parseISO(nexRunTime), "PPP") : "Not scheduled"}</span>
        </Badge>
      );
    },
  },
  {
    accessorKey: "lastScan",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Scan" />,
    sortingFn: (rowA, rowB) => sortLastScan(rowA.original.lastScan?.startTime, rowB.original.lastScan?.startTime),
    meta: { sort: true },
    cell: ({ row }) => {
      const lastScan = row.getValue("lastScan") as Schedule["lastScan"];
      return (
        <Badge variant="outline" className="flex gap-2 p-0 w-fit items-center border-none bg-transparent ">
          <Calendar className="size-4" />
          <span className="text-sm">{lastScan ? format(parseISO(lastScan.startTime), "PPP") : "Never"}</span>
        </Badge>
      );
    },
  },

  {
    id: "actions",
    header: "Actions",
    meta: { className: "w-20" },
    cell: ({ row }) => <ScheduleRowActions schedule={row.original} />,
  },
];
