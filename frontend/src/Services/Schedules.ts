import api from "@/lib/api";
import type { ScanSchedule, Asset, CreateSchedulePayload } from "@/types";

export const fetchSchedules = async () => {
  const { data } = await api.get("/api/scan-schedules");
  const items = (data as { data: ScanSchedule[] }).data ?? data;
  return Array.isArray(items) ? items : [];
};

export const fetchSchedule = async (id: string) => {
  const { data } = await api.get(`/api/scan-schedules/${id}`);
  const item = (data as { data: ScanSchedule }).data ?? data;
  return item;
};

export const createSchedule = async (payload: CreateSchedulePayload) => {
  const { data } = await api.post("/api/scan-schedules", payload);
  return data;
};

export const updateSchedule = async (id: string, updatedSchedule: Partial<ScanSchedule>) => {
  const { data } = await api.patch(`/api/scan-schedules/${id}`, updatedSchedule);
  return data;
};

export const deleteSchedule = async (id: string) => {
  const { data } = await api.delete(`/api/scan-schedules/${id}`);
  return data;
};

export const fetchAssetsForSchedules = async () => {
  const { data } = await api.get("/api/assets", { params: { limit: 100 } });
  const items = (data as { data: Asset[] }).data ?? data;
  return Array.isArray(items) ? items : [];
};
