"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "checked" | "onCheckedChange"> {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  checked = false,
  onCheckedChange,
  className,
  disabled = false,
  ...props
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      disabled={disabled}
      data-state={checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked"}
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-transparent",
        checked === "indeterminate" && "bg-primary border-primary text-primary-foreground",
        className
      )}
      onClick={() => onCheckedChange?.(checked === "indeterminate" ? true : !checked)}
      {...props}
    >
      {checked === "indeterminate" ? (
        <span className="flex items-center justify-center">
          <Minus className="size-3" />
        </span>
      ) : checked ? (
        <span className="flex items-center justify-center">
          <Check className="size-3" />
        </span>
      ) : null}
    </button>
  );
}

export { Checkbox };
