import { rangoDelDia, sumarDias, type Cita, type Usuario } from "@cident/shared";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../app/firebase";
import { mensajeError } from "../../lib/mensajeError";
import { appointmentsCollection } from "./agendaApi";
import { hoyLocal } from "./fechas";

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
 * Mantiene en la caché local (IndexedDB) las citas desde 7 días atrás hasta 30
 * adelante, para poder consultar la agenda sin conexión aunque el usuario no
 * haya navegado a esas semanas. No expone datos: solo mantiene la escucha.
 */
export function usePrecargaAgenda(centroId: string | undefined) {
  useEffect(() => {
    if (!centroId) return;
    const hoy = hoyLocal();
    const q = query(
      appointmentsCollection(),
      where("centroId", "==", centroId),
      where("inicio", ">=", rangoDelDia(sumarDias(hoy, -7)).inicio),
      where("inicio", "<", rangoDelDia(sumarDias(hoy, 30)).inicio),
      orderBy("inicio"),
    );
    return onSnapshot(q, () => {}, () => {});
  }, [centroId]);
}

/**
 * Profesionales agendables del centro. Los admin quedan fuera a propósito:
 * administran centros y usuarios, no atienden pacientes, así que no deben
 * aparecer como columna de la agenda ni como opción del formulario de cita.
 *
 * La consulta coincide exactamente con el índice `users(centroId,
 * nombreCompleto)`: `activo` y `rol` se filtran en el cliente para no exigir un
 * índice compuesto adicional.
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
        setProfesionales(
          snap.docs
            .map((d) => d.data() as Usuario)
            .filter((u) => u.activo && u.rol === "profesional"),
        ),
      (err) => setError(mensajeError(err)),
    );
  }, [centroId]);

  return { profesionales, error };
}
