"use client";

import { z } from "zod";

export const ScheduleFormSchema = z.object({
  assetId: z.string().min(1, "Target asset is required"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  scanType: z.enum(["QUICK", "DEEP"]),
  scheduledTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  isActive: z.boolean(),
});

export type ScheduleFormValues = z.infer<typeof ScheduleFormSchema>;
