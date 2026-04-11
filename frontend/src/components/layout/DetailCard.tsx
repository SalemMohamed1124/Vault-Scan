import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  children: ReactNode;
  className?: string;
}

function DetailCardRoot({ children, className }: DetailCardProps) {
  return <div className={cn("flex flex-col gap-6 px-6 py-5 w-full", className)}>{children}</div>;
}

function DetailCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1 pb-4 border-b", className)}>{children}</div>;
}

function DetailCardSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>;
}

function DetailCardRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-between items-center", className)}>{children}</div>;
}

function DetailCardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("pt-2 text-[10px] text-muted-foreground uppercase tracking-wider text-right", className)}>{children}</div>
  );
}

export const DetailCard = Object.assign(DetailCardRoot, {
  Header: DetailCardHeader,
  Section: DetailCardSection,
  Row: DetailCardRow,
  Footer: DetailCardFooter,
});
