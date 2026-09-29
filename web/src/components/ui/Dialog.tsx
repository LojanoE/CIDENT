import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Button, type VarianteBoton } from "./Button";
import { useSuperposicion } from "./useSuperposicion";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
  actions: ReactNode;
}

export function Dialog({ open, onClose, title, description, className, children, actions }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();
  const onKeyDown = useSuperposicion(open, onClose, panel);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 md:items-center">
      <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={description ? idDescripcion : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn("relative w-full max-w-md space-y-4 rounded-lg bg-surface p-5 shadow-sheet outline-none", className)}
      >
        <h2 id={idTitulo} className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <div id={idDescripcion} className="text-sm text-ink-soft">
            {description}
          </div>
        )}
        {children}
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmarDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: VarianteBoton;
  loading?: boolean;
}

/** Confirmación de acciones irreversibles. El foco inicial cae en «Cancelar», la opción segura. */
export function ConfirmarDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "primary",
  loading,
}: ConfirmarDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="secondary" data-autofocus onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
