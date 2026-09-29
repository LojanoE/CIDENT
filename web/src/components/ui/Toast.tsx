import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TipoToast = "ok" | "error" | "info";

interface ItemToast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

interface Notificador {
  ok: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
}

const ContextoToast = createContext<Notificador | null>(null);

const estilos: Record<TipoToast, { caja: string; icono: ReactNode }> = {
  ok: { caja: "border-ok/40", icono: <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-ok" /> },
  error: { caja: "border-danger/40", icono: <AlertCircle aria-hidden className="h-5 w-5 shrink-0 text-danger" /> },
  info: { caja: "border-line", icono: <Info aria-hidden className="h-5 w-5 shrink-0 text-accent" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemToast[]>([]);
  const siguiente = useRef(0);

  const cerrar = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const notificador = useMemo<Notificador>(() => {
    const publicar = (tipo: TipoToast) => (mensaje: string) => {
      const id = ++siguiente.current;
      setItems((prev) => [...prev, { id, tipo, mensaje }]);
      // Los errores permanecen más tiempo: hay que leerlos y actuar.
      window.setTimeout(() => cerrar(id), tipo === "error" ? 9000 : 4500);
    };
    return { ok: publicar("ok"), error: publicar("error"), info: publicar("info") };
  }, [cerrar]);

  return (
    <ContextoToast.Provider value={notificador}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-stretch gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tipo === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface p-3 text-sm shadow-sheet",
              estilos[t.tipo].caja,
            )}
          >
            {estilos[t.tipo].icono}
            <p className="flex-1 pt-px">{t.mensaje}</p>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => cerrar(t.id)}
              className="-m-2 flex min-h-touch min-w-touch items-center justify-center rounded-md text-ink-soft hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ContextoToast.Provider>
  );
}

export function useToast(): Notificador {
  const ctx = useContext(ContextoToast);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}
