import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { useAtributosCampo } from "./Field";

// 16 px en móvil: por debajo, iOS hace zoom automático al enfocar el campo.
const base =
  "block w-full min-h-touch rounded-md border border-input bg-surface px-3 text-base text-ink " +
  "placeholder:text-ink-soft md:min-h-10 md:text-sm " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger " +
  "disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-soft";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(base, className)} {...useAtributosCampo()} {...rest} />;
}

export function Textarea({ className, rows = 3, ...rest }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(base, "py-2", className)} {...useAtributosCampo()} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cn(base, "appearance-none pr-9", className)} {...useAtributosCampo()} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
      />
    </span>
  );
}
