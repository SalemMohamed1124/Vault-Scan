import api from "@/lib/api";
import type { Scan, PaginatedResponse, ScanStatus, ScanFinding, StartScanPayload } from "@/types";

export async function fetchScans(params: {
  page?: number;
  limit?: number;
  status?: ScanStatus | "ALL";
  search?: string;
}) {
  const queryParams: Record<string, string | number> = {
    page: params.page || 1,
    limit: params.limit || 10,
  };
  if (params.status && params.status !== "ALL") queryParams.status = params.status;
  if (params.search) queryParams.search = params.search;

  const { data } = await api.get<PaginatedResponse<Scan>>("/api/scans", {
    params: queryParams,
  });
  return data;
}

export async function fetchScan(id: string) {
  const { data } = await api.get<Scan>(`/api/scans/${id}`);
  return data;
}

export async function startScan(payload: StartScanPayload) {
  const { data } = await api.post("/api/scans", payload);
  return data as { id: string };
}

export async function deleteScan(id: string) {
  await api.delete(`/api/scans/${id}`);
}

export async function fetchScanFindings(id: string) {
  const { data } = await api.get(`/api/scans/${id}/findings`);
  const items = (data as { data: ScanFinding[] }).data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function createScanReport(scanId: string, format: string = "PDF") {
  const { data } = await api.post(`/api/reports`, { scanId, format });
  return data;
}
