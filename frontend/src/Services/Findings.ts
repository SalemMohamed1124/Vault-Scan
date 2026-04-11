import api from "@/lib/api";
import type { Severity } from "@/types";

export async function fetchFindings(params: {
  page?: number;
  limit?: number;
  severity?: Severity | "ALL";
  category?: string | "ALL";
  search?: string;
}) {
  const queryParams: Record<string, string | number> = {
    page: params.page || 1,
    limit: params.limit || 15,
  };
  if (params.severity && params.severity !== "ALL") queryParams.severity = params.severity;
  if (params.category && params.category !== "ALL") queryParams.category = params.category;
  if (params.search) queryParams.search = params.search;

  const { data } = await api.get("/api/scan-findings", { params: queryParams });
  return data;
}

export async function deleteFinding(id: string) {
  await api.delete(`/api/scan-findings/${id}`);
}

export async function deleteFindings(ids: string[]) {
  await api.delete("/api/scan-findings", { data: { ids } });
}
