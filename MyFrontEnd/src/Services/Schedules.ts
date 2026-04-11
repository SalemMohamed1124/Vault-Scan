import type { Schedule } from "@/Types/data-types";
import { fakeSchedules } from "../../public/Schedules";

export async function fetchSchedules() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return [...fakeSchedules];
}

export async function deleteSchedule(id: string) {
  await new Promise((r) => setTimeout(r, 200));
  const index = fakeSchedules.findIndex((p) => p.id === id);
  if (index !== -1) fakeSchedules.splice(index, 1);
}

export async function updateSchedule(id: string, updatedSchedule: Partial<Omit<Schedule, "id">>) {
  await new Promise((r) => setTimeout(r, 200));
  const index = fakeSchedules.findIndex((p) => p.id === id);
  if (index !== -1) {
    fakeSchedules[index] = { ...fakeSchedules[index], ...updatedSchedule };
  }
}
