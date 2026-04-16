"use client";

import * as React from "react";
import { type Table } from "@tanstack/react-table";
import { ArrowDownUp, Funnel, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogTrigger, DialogFooter, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SortFilterModalProvider, useSortFilter } from "@/Contexts/SortFilterModalContext";

// --- Main Component ---

type DataTableSortFilterModalProps<TData> = {
  table: Table<TData>;
  sortColumns?: string[];
  filterColumns?: string[];
};

export default function DataTableSortFilterModal<TData>({
  table,
  sortColumns = [],
  filterColumns = [],
}: DataTableSortFilterModalProps<TData>) {
  const [open, setOpen] = React.useState(false);

  return (
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3 transition-none">
          <Funnel className="mr-2 size-4 opacity-50" /> Sort & Filter
        </Button>
      </DialogTrigger>

      <DialogContent className=" bg-background p-0 overflow-hidden ">
        <SortFilterModalProvider
          table={table}
          sortColumns={sortColumns}
          filterColumns={filterColumns}
          isOpen={open}
          onClose={() => setOpen(false)}
        >
          <DialogHeader className="px-4 py-3.5">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">Filter & Sort Options</DialogTitle>
          </DialogHeader>

          <ScrollArea className="px-6 max-h-[45vh]">
            <div className="space-y-6">
              <SortSection />
              <Separator />
              <FilterSection />
            </div>
          </ScrollArea>

          <FooterAction />
        </SortFilterModalProvider>
      </DialogContent>
    </Dialog>
  );
}

// --- Sub-components ---

function SortSection() {
  const { sortColumns, sortColumn, setSortColumn, sortOrder, setSortOrder } = useSortFilter();
  if (!sortColumns) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <ArrowDownUp className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Sorting</h3>
      </div>
      <div className="space-y-4 rounded-lg  ">
        <RadioGroup value={sortColumn ?? ""} onValueChange={setSortColumn}>
          {sortColumns.map((col) => (
            <div key={col} className="flex items-center space-x-2 bg-background p-2 rounded-md border hover:border-blue-500">
              <RadioGroupItem value={col} id={`sort-${col}`} />
              <label htmlFor={`sort-${col}`} className="flex-1 text-sm font-medium capitalize cursor-pointer">
                {col}
              </label>
            </div>
          ))}
        </RadioGroup>

        {sortColumn && (
          <div className="space-y-2 pt-2 border-t">
            <RadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="asc" id="asc" />
                <label htmlFor="asc" className="text-sm">
                  A → Z
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="desc" id="desc" />
                <label htmlFor="desc" className="text-sm">
                  Z → A
                </label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterSection() {
  const { filterColumns, uniqueValues, filters, toggleFilterValue } = useSortFilter();

  return (
    <section className="space-y-4 pb-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Funnel className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Filters</h3>
      </div>
      <div className="space-y-6">
        {filterColumns.map((col) => (
          <div key={col} className="space-y-3">
            <h4 className="text-sm font-bold capitalize px-1">{col}</h4>
            <div className="grid gap-2 pl-1">
              {uniqueValues[col]?.map((value) => (
                <div key={value} className="flex items-center space-x-3">
                  <Checkbox
                    id={`filter-${col}-${value}`}
                    checked={filters[col]?.has(value) ?? false}
                    onCheckedChange={() => toggleFilterValue(col, value)}
                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <label htmlFor={`filter-${col}-${value}`} className="text-sm font-medium cursor-pointer">
                    {value}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FooterAction() {
  const { resetAll, applyChanges } = useSortFilter();
  return (
    <DialogFooter className="p-4 border-t bg-muted/20 flex-row gap-2 sm:justify-evenly items-center">
      <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground hover:text-destructive">
        <RotateCcw className="mr-2 h-3 w-3" /> Clear All
      </Button>
      <Button onClick={applyChanges} size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">
        Apply Changes
      </Button>
    </DialogFooter>
  );
}
