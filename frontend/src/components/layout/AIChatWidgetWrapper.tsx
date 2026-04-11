"use client";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { AIChatWidget } from "@/Features/ai/AIChatWidget";

const SCAN_DETAIL_RE = /^\/scans\/([0-9a-f-]{36})$/i;

export function AIChatWidgetWrapper() {
  const pathname = usePathname();
  const scanId = useMemo(() => pathname.match(SCAN_DETAIL_RE)?.[1], [pathname]);
  return <AIChatWidget scanId={scanId} />;
}
