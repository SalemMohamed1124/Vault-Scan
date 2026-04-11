import { z } from "zod";

export const IpSchema = z.union([z.ipv4(), z.ipv6()]);
export const DomainSchema = z.string().regex(/^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/);
export const UrlSchema = z.string().url().regex(/^https?:\/\//i);
export const CidrSchema = z.string().regex(/^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/);

export const AssetFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    type: z.enum(["DOMAIN", "IP", "URL", "CIDR"], {
      message: "Asset type is required",
    }),
    value: z.string().min(1, "Value is required").max(255, "Value is too long"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DOMAIN") {
      const result = DomainSchema.safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Invalid domain format",
        });
      }
    }

    if (data.type === "IP") {
      const result = IpSchema.safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Invalid IP address format",
        });
      }
    }

    if (data.type === "URL") {
      const result = UrlSchema.safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Invalid URL format (must start with http:// or https://)",
        });
      }
    }

    if (data.type === "CIDR") {
      const result = CidrSchema.safeParse(data.value);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Invalid CIDR format (e.g., 192.168.1.0/24)",
        });
      }
    }
  });

export type AssetFormValues = z.infer<typeof AssetFormSchema>;

export const BulkAssetFormSchema = z.object({
  targets: z.string().min(1, "Targets are required"),
});

export type BulkAssetFormValues = z.infer<typeof BulkAssetFormSchema>;
