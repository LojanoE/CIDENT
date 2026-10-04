import type { ItemPlan } from "@cident/shared";
import { useEffect, useState } from "react";
import { mensajeError } from "../../lib/mensajeError";
import { escucharPlan } from "./planApi";

/** Plan de tratamiento del paciente en vivo (`items` es `null` mientras carga). */
export function usePlan(patientId: string, centroId: string) {
  const [items, setItems] = useState<ItemPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !centroId) return;
    return escucharPlan(patientId, centroId, setItems, (err) => setError(mensajeError(err)));
  }, [patientId, centroId]);

  return { items, error };
}
