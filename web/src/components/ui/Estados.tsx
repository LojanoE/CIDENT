import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TonoBadge = "neutral" | "accent" | "ok" | "warn" | "danger";

const tonos: Record<TonoBadge, string> = {
  neutral: "bg-bg text-ink-soft border-line",
  accent: "bg-accent-wash text-accent border-accent/25",
  ok: "bg-ok/10 text-ok border-ok/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

/** El significado nunca va solo en el color: el texto (y, opcionalmente, un icono) lo repite. */
export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: TonoBadge;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tonos[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ label = "Cargando…", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-ink-soft", className)}>
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function Skeleton({ className, ...rest }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-line", className)} {...rest} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      {icon && <div className="text-ink-soft">{icon}</div>}
      <p className="text-base font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
