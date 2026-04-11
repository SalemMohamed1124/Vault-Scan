"use client";

import { useViewModal } from "@/Contexts/ViewModalContext";
import ReportForm from "./ReportForm";
import { Button } from "@/components/ui/button";
import { FilePlus2, Plus } from "lucide-react";

export function useReportFormModals() {
  const { view } = useViewModal();

  const openGenerate = () => {
    view({
      title: "Generate Investigation Report",
      content: <ReportForm onSuccess={() => {}} />,
      noPadding: true,
      defaultScroll: false,
    });
  };

  return { openGenerate };
}

export function ReportTableActions() {
  const { openGenerate } = useReportFormModals();

  return (
    <Button onClick={openGenerate} className={"flex-1"}>
      <Plus className="size-3.5" />
      Generate Report
    </Button>
  );
}
