import { z } from "zod";

export const ScheduleFormSchema = z
  .object({
    asset: z.any().refine((val) => val && typeof val === "object", "Asset is required"),
    scanType: z.enum(["full", "vulnerability", "port", "quick"]),
    mode: z.enum(["once", "repeat", "none"]).nullable(),
    repeatEvery: z.number().nullable(),
    repeatUnit: z.enum(["day", "week", "month"]).nullable(),
    startDate: z.date().nullable(),
    startTime: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "repeat" && !data.startDate) {
      ctx.addIssue({
        path: ["startDate"],
        message: "Start date is required",
        code: "custom",
      });
    }
    if (data.startDate && !data.startTime) {
      ctx.addIssue({
        path: ["startTime"],
        message: "Start time is required",
        code: "custom",
      });
    }
  });

export type ScheduleFormValues = z.infer<typeof ScheduleFormSchema>;
