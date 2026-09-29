import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let abiertas = 0;
let overflowPrevio = "";

function bloquearFondo() {
  if (abiertas++ === 0) {
    overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.getElementById("root")?.setAttribute("inert", "");
  }
}

function liberarFondo() {
  if (--abiertas === 0) {
    document.body.style.overflow = overflowPrevio;
    document.getElementById("root")?.removeAttribute("inert");
  }
}

/**
 * Comportamiento común de Sheet y Dialog: bloquea el scroll, deja el resto de la app inerte
 * (no enfocable ni visible para lectores de pantalla), enfoca el panel al abrir y devuelve
 * el foco al disparador al cerrar. Devuelve el manejador de teclado (Escape y trampa de Tab).
 */
export function useSuperposicion(abierto: boolean, alCerrar: () => void, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!abierto) return;
    const disparador = document.activeElement as HTMLElement | null;
    bloquearFondo();
    const el = panel.current;
    const primero = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCALIZABLES);
    (primero ?? el)?.focus();
    return () => {
      liberarFondo();
      disparador?.focus?.();
    };
  }, [abierto, panel]);

  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      alCerrar();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCALIZABLES));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };
}
