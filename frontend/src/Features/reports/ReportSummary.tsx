"use client";

import { useReports } from "./useReports";
import { Summary } from "@/components/layout/Summary";
import { FileText, FileCheck, Clock, Archive } from "lucide-react";

export default function ReportSummary() {
  const { reports, isPending } = useReports();

  // Calculate stats from the flat list (since backend doesn't provide them)
  const data = reports?.data || [];
  const total = data.length;
  const active = data.filter((r) => new Date(r.expiresAt) > new Date()).length;
  const expired = total - active;
  const latestFormat = data[0]?.format || "None";

  return (
    <Summary data={[]}>
      <Summary.Card
        label="Total Documents"
        variant="none"
        icon={<Archive className="size-4" />}
        counts={isPending ? "..." : total}
        sublabel="GENERATED REPORTS"
      />
      <Summary.Card
        label="Active Status"
        variant="success"
        icon={<FileCheck className="size-4" />}
        counts={isPending ? "..." : active}
        sublabel="VALID DOCUMENTS"
      />
      <Summary.Card
        label="Expired"
        variant="none"
        icon={<Clock className="size-4" />}
        counts={isPending ? "..." : expired}
        sublabel="PAST EXPIRY"
      />
      <Summary.Card
        label="Latest Format"
        variant="informative"
        icon={<FileText className="size-4" />}
        counts={isPending ? "..." : latestFormat}
        sublabel="CURRENT OUTPUT"
      />
    </Summary>
  );
}

