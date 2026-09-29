import type { Atencion } from "@cident/shared";
import { createContext, useContext } from "react";

/** Lo que `AtencionLayout` comparte con sus pestañas. */
export interface ContextoAtencion {
  atencion: Atencion;
  /** Sustituye la atención en memoria tras guardarla (el layout refleja estado y título). */
  alActualizar: (atencion: Atencion) => void;
}

export const AtencionContext = createContext<ContextoAtencion | null>(null);

export function useAtencion(): ContextoAtencion {
  const ctx = useContext(AtencionContext);
  if (!ctx) throw new Error("useAtencion debe usarse dentro de AtencionLayout.");
  return ctx;
}
