import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileCardProps {
  children: ReactNode;
  className?: string;
}

function MobileCardRoot({ children, className }: MobileCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 p-4 border border-border rounded-lg bg-card text-card-foreground shadow-sm", className)}
    >
      {children}
    </div>
  );
}

function MobileCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-between items-center", className)}>{children}</div>;
}

function MobileCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 mt-1", className)}>{children}</div>;
}

function MobileCardRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-between items-center", className)}>{children}</div>;
}

function MobileCardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pt-2 border-t border-border mt-1", className)}>{children}</div>;
}

export const MobileCard = Object.assign(MobileCardRoot, {
  Header: MobileCardHeader,
  Content: MobileCardContent,
  Row: MobileCardRow,
  Footer: MobileCardFooter,
});
