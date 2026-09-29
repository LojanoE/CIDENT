import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Barra de acciones fija al borde inferior del contenido. En móvil se apoya sobre la
 * barra de pestañas (56 px) para que ninguna tape a la otra.
 */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:-mx-6 md:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
