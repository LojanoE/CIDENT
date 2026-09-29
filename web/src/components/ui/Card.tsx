import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-5", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("p-4 md:p-5", className)} {...rest} />;
}
