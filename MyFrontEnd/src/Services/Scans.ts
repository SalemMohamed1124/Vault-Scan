import { ScansSchema, ScanSchema } from "@/Types/data-types";
import { mockScanHistory } from "../../public/ScanHistoryData";

export async function fetchScans() {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return ScansSchema.parse(mockScanHistory);
}

export async function fetchScan(id: string) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return ScanSchema.parse(mockScanHistory.find((s) => s.id === id));
}

export async function deleteScan(id: string) {
  await new Promise((r) => setTimeout(r, 200));
  const index = mockScanHistory.findIndex((s) => s.id === id);
  if (index !== -1) mockScanHistory.splice(index, 1);
}
