import type { Cita, Usuario } from "@cident/shared";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../app/firebase";
import { mensajeError } from "../../lib/mensajeError";
import { appointmentsCollection } from "./agendaApi";

/**
 * Citas del centro con `inicio` en [desde, hasta). Una sola consulta por rango
 * sirve a la vista de día y a la de semana; las rules revalidan cada documento,
 * pero no inyectan el filtro por `centroId`, por eso va explícito.
 */
export function useCitasDelRango(centroId: string | undefined, desde: string, hasta: string) {
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    setCitas(null);
    setError(null);
    const q = query(
      appointmentsCollection(),
      where("centroId", "==", centroId),
      where("inicio", ">=", desde),
      where("inicio", "<", hasta),
      orderBy("inicio"),
    );
    return onSnapshot(
      q,
      (snap) => setCitas(snap.docs.map((d) => d.data() as Cita)),
      (err) => setError(mensajeError(err)),
    );
  }, [centroId, desde, hasta]);

  return { citas, error };
}

/**
 * Colegas del centro. La consulta coincide exactamente con el índice
 * `users(centroId, nombreCompleto)`: `activo` se filtra en el cliente para no
 * exigir un índice compuesto adicional.
 */
export function useProfesionalesDelCentro(centroId: string | undefined) {
  const [profesionales, setProfesionales] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    setProfesionales(null);
    setError(null);
    const q = query(
      collection(db, "users"),
      where("centroId", "==", centroId),
      orderBy("nombreCompleto"),
    );
    return onSnapshot(
      q,
      (snap) =>
        setProfesionales(snap.docs.map((d) => d.data() as Usuario).filter((u) => u.activo)),
      (err) => setError(mensajeError(err)),
    );
  }, [centroId]);

  return { profesionales, error };
}
