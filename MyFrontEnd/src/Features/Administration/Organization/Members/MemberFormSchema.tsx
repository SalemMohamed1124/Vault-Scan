import { z } from "zod";

export const MemberFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "editor", "viewer"]),
});

export type MemberFormValues = z.infer<typeof MemberFormSchema>;
