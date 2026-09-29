import { useSyncExternalStore } from "react";

/** Suscripción a `matchMedia`. En entornos sin `window` (SSR/tests) devuelve `false`. */
export function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const mql = window.matchMedia(consulta);
      mql.addEventListener("change", aviso);
      return () => mql.removeEventListener("change", aviso);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** Ancho `md` de Tailwind (768 px). */
export const useEsEscritorio = () => useMediaQuery("(min-width: 768px)");
