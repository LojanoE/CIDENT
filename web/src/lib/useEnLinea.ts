import { useSyncExternalStore } from "react";

/** `true` mientras el navegador reporta conexión (`navigator.onLine` + eventos online/offline). */
export function useEnLinea(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      window.addEventListener("online", aviso);
      window.addEventListener("offline", aviso);
      return () => {
        window.removeEventListener("online", aviso);
        window.removeEventListener("offline", aviso);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
