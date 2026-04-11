"use client";

import { z } from "zod";

export const ReportFormSchema = z.object({
  scanId: z.string().min(1, "Source investigation is required"),
  format: z.enum(["PDF", "JSON", "HTML"]),
});

export type ReportFormValues = z.infer<typeof ReportFormSchema>;
