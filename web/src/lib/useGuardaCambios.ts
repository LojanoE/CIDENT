import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Avisa antes de abandonar una pantalla con cambios sin guardar (navegación interna y cierre de pestaña).
 * Solo debe haber una guarda montada por router: `useBlocker` es único por árbol de rutas.
 * `permitirSalida()` se llama justo antes de una navegación propia (p. ej. tras crear el registro).
 */
export function useGuardaCambios(sucio: boolean) {
  const sucioRef = useRef(sucio);
  const permitidoRef = useRef(false);

  useEffect(() => {
    sucioRef.current = sucio;
  }, [sucio]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sucioRef.current && !permitidoRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (sucioRef.current && !permitidoRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, []);

  const permitirSalida = () => {
    permitidoRef.current = true;
  };

  return { blocker, permitirSalida };
}
