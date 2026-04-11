import type { Schedule } from "@/Types/data-types";

//   Checks if an asset already has an active schedule.

export function isAssetAlreadyScheduled(assetId: string, schedules: Schedule[]): Schedule | undefined {
  if (!assetId) return undefined;
  return schedules.find((s) => s.asset.id === assetId);
}

// importrant for sorting functionality in schedule table

export function getFrequencyWeight(frequency: Schedule["frequency"]) {
  if (frequency === null || frequency === undefined) return Number.MAX_SAFE_INTEGER;
  if (frequency.mode === "once") return Number.MIN_SAFE_INTEGER;

  const { repeatEvery, repeatUnit } = frequency;
  if (repeatEvery === null || repeatEvery === undefined || repeatUnit === null || repeatUnit === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  let multiplier = 1;
  switch (repeatUnit) {
    case "day":
      multiplier = 1;
      break;
    case "week":
      multiplier = 7;
      break;
    case "month":
      multiplier = 30;
      break;
  }
  return repeatEvery * multiplier;
}

export function sortFrequency(rowA: any, rowB: any) {
  const weightA = getFrequencyWeight(rowA.original.frequency);
  const weightB = getFrequencyWeight(rowB.original.frequency);
  return weightA - weightB;
}

export function sortNextRunTime(rowA: any, rowB: any) {
  const timeA = rowA.original.nexRunTime ? new Date(rowA.original.nexRunTime).getTime() : Number.MAX_SAFE_INTEGER;
  const timeB = rowB.original.nexRunTime ? new Date(rowB.original.nexRunTime).getTime() : Number.MAX_SAFE_INTEGER;
  return timeA - timeB;
}

export function sortLastScan(A: any, B: any) {
  const timeA = new Date(A).getTime();
  const timeB = new Date(B).getTime();
  return timeA - timeB;
}
