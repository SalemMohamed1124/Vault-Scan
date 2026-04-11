import { z } from "zod";

export const ScanFormSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  type: z.enum(["QUICK", "DEEP"], {
    message: "Scan type is required",
  }),
  authMode: z.enum(["auto", "credentials", "cookies", "none"]),
  username: z.string().optional(),
  password: z.string().optional(),
  loginUrl: z.string().optional(),
  cookies: z.string().optional(),
  customHeaders: z.string().optional(),
});

export type ScanFormValues = z.infer<typeof ScanFormSchema>;
