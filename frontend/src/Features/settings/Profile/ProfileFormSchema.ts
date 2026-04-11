import { z } from "zod";

export const ProfileFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

export const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(100, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type PasswordFormValues = z.infer<typeof PasswordFormSchema>;
