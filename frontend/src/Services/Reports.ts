import api from "@/lib/api";
import type { Report, Scan } from "@/types";

export async function fetchReports() {
  const { data } = await api.get("/api/reports");
  const items = (data as { data: Report[] }).data ?? data;
  return { data: Array.isArray(items) ? items : [] };
}

export async function fetchReport(id: string) {
  const { data } = await api.get<Report>(`/api/reports/${id}`);
  return data;
}

export async function fetchCompletedScansForReports() {
  const { data } = await api.get("/api/scans", {
    params: { status: "COMPLETED", limit: 50 },
  });
  const items = (data as { data: Scan[] }).data ?? data;
  return Array.isArray(items) ? items : [];
}

export async function generateReport(payload: { scanId: string; format: string }) {
  const { data } = await api.post("/api/reports", payload);
  return data;
}

export async function downloadReportFile(reportId: string, format: string) {
  const response = await api.get(`/api/reports/download/${reportId}`, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${reportId.slice(0, 8)}.${format.toLowerCase()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
