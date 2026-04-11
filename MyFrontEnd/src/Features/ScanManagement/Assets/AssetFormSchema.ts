import { z } from "zod";

export const IpSchema = z.union([z.ipv4(), z.ipv6()]);
export const DomainSchema = z.string().regex(/^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/);
export const AssetFormSchema = z

  .object({
    name: z.string().min(1, "Asset name is required").max(100),
    type: z.enum(["domain", "ip"]),
    value: z.string().min(1, "Asset value is required"),
    tags: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "domain") {
      const result = DomainSchema.safeParse(data.value);
      if (!result.success)
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "invalid domain format",
        });
    }

    if (data.type === "ip") {
      const result = IpSchema.safeParse(data.value);
      if (!result.success)
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "invalid ip format",
        });
    }
  });

export type AssetFormValues = z.infer<typeof AssetFormSchema>;
