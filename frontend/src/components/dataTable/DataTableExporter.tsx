"use client";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, FileBraces, Sheet } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import type { Table } from "@tanstack/react-table";

type TableExporterProps<TData> = {
  table: Table<TData>;
  fileName?: string;
  className?: string;
};

export default function TableExporter<TData>({ table, fileName, className }: TableExporterProps<TData>) {
  const data = table?.getPrePaginationRowModel().rows.map((row) => row.original);

  const handleExportXLSX = () => {
    if (!data || data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleExportJSON = () => {
    if (!data || data.length === 0) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const { isMobile } = useSidebar();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${className ?? " "}`} asChild>
        <Button variant="outline">
          <Download />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isMobile ? "start" : "end"} side="bottom" className={isMobile ? "w-40" : ""}>
        <DropdownMenuItem onClick={handleExportXLSX} className="font-light ">
          <Sheet className="h-4 w-4 opacity-60" /> XLSX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} className="font-light">
          <FileBraces className="h-4 w-4 opacity-60 " />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
