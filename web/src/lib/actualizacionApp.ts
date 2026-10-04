import { useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

const INTERVALO_MS = 30 * 60 * 1000;

let hayNueva = false;
const oyentes = new Set<() => void>();
let aplicar: ((recargar?: boolean) => Promise<void>) | null = null;

function avisar() {
  oyentes.forEach((o) => o());
}

/**
 * Registra el service worker y busca versiones nuevas al volver a la app y cada 30 min.
 * En el celular la PWA instalada casi nunca se recarga, así que sin esto seguiría con el JS viejo.
 */
export function iniciarActualizaciones() {
  if (!("serviceWorker" in navigator)) return;
  aplicar = registerSW({
    onNeedRefresh() {
      hayNueva = true;
      avisar();
    },
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const buscar = () => {
        if (navigator.onLine) void registro.update().catch(() => undefined);
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") buscar();
      });
      window.setInterval(buscar, INTERVALO_MS);
    },
  });
}

/** Activa el service worker nuevo y recarga la página. */
export function aplicarActualizacion() {
  void aplicar?.(true);
}

/** `true` cuando hay una versión nueva descargada esperando a activarse. */
export function useHayActualizacion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    () => hayNueva,
    () => false,
  );
}
