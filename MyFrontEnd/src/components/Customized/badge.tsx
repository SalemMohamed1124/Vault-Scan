import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

  const badgeVariants = cva(
    "flex justify-center w-fit items-center  rounded-md border px-2 py-0.5 text-[10px] sm:text-xs font-medium transition-colors capitalize  ",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground border-transparent",
          secondary: "bg-secondary text-secondary-foreground border-transparent",
          destructive: "bg-destructive text-destructive-foreground border-transparent",
          outline: "text-foreground",
        },
        theme: {
          critical: "bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
          high: "bg-orange-100 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900",
          medium:
            "bg-yellow-100 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900",
          low: "bg-blue-100 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900",
          none: "bg-green-100 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700",
          informative:
            "bg-purple-100 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900",
          outlineSecondary: "bg-gray-100 dark:bg-gray-950/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800",
        },
      },
      defaultVariants: {
        variant: "default",
      },
    }
  );

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, theme, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, theme }), className)} {...props} />;
}

export { Badge };
