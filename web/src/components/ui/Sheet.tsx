import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useSuperposicion } from "./useSuperposicion";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Panel lateral en escritorio y hoja inferior (~85 vh) en móvil, para que lo que se está
 * editando siga visible por encima.
 */
export function Sheet({ open, onClose, title, description, footer, className, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();
  const onKeyDown = useSuperposicion(open, onClose, panel);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={description ? idDescripcion : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "absolute flex flex-col bg-surface shadow-sheet outline-none",
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg pb-[env(safe-area-inset-bottom)]",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:pb-0",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
          <div>
            <h2 id={idTitulo} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={idDescripcion} className="text-13 text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="-mr-2 flex min-h-touch min-w-touch items-center justify-center rounded-md text-ink-soft hover:bg-accent-wash hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3 md:px-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
