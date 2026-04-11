import type { ColumnDef } from "@tanstack/react-table";
import type { Notification } from "@/Types/data-types";
import NotificationCard from "./NotificationCard";
import { facetedFilter } from "@/lib/utils";

export const NotificationColumns: ColumnDef<Notification>[] = [
  {
    id: "card",
    meta: {
      className: "p-0",
      hideOnDesktop: true,
    },
    cell: ({ row }) => <NotificationCard notification={row.original} />,
  },
  {
    accessorKey: "title",
    filterFn: facetedFilter,
    meta: { search: { placeholder: "Search notifications..." } },
  },
  {
    accessorKey: "type",
    filterFn: facetedFilter,
    meta: { filter: true },
  },
  {
    accessorKey: "read",
    filterFn: facetedFilter,
    meta: { filter: true },
  },
  { accessorKey: "createdAt", meta: { sort: true }, sortingFn: "datetime" },
];
