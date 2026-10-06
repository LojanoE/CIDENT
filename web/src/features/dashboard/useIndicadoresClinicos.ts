import {
  calcularIndicadores,
  mesAnterior,
  mesSiguiente,
  type EstadoCita,
  type EstadoPresupuesto,
  type Indicadores,
} from "@cident/shared";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../app/firebase";
import { mensajeError } from "../../lib/mensajeError";

export interface IndicadoresDelMes {
  mes: string;
  actual: Indicadores;
  previo: Indicadores;
  /** uid → nombre, para rotular las barras por profesional. */
  nombres: Record<string, string>;
}

async function indicadoresDe(centroId: string, mes: string): Promise<Indicadores> {
  const desde = `${mes}-01`;
  const hasta = `${mesSiguiente(mes)}-01`;
  const [citas, pacientes, visitas, plan, presupuestos] = await Promise.all([
    getDocs(
      query(
        collection(db, "appointments"),
        where("centroId", "==", centroId),
        where("inicio", ">=", `${desde}T00:00`),
        where("inicio", "<", `${hasta}T00:00`),
      ),
    ),
    getDocs(
      query(
        collection(db, "patients"),
        where("centroId", "==", centroId),
        where("createdAt", ">=", desde),
        where("createdAt", "<", hasta),
      ),
    ),
    getDocs(
      query(
        collectionGroup(db, "visits"),
        where("centroId", "==", centroId),
        where("fecha", ">=", desde),
        where("fecha", "<", hasta),
      ),
    ),
    getDocs(
      query(
        collectionGroup(db, "planTratamiento"),
        where("centroId", "==", centroId),
        where("realizado.fecha", ">=", desde),
        where("realizado.fecha", "<", hasta),
      ),
    ),
    getDocs(
      query(
        collectionGroup(db, "budgets"),
        where("centroId", "==", centroId),
        where("fecha", ">=", desde),
        where("fecha", "<", hasta),
      ),
    ),
  ]);

  return calcularIndicadores({
    citas: citas.docs.map((d) => ({ estado: d.data().estado as EstadoCita })),
    pacientesNuevos: pacientes.size,
    atenciones: visitas.docs
      .map((d) => d.data() as { estado?: string; finalizedBy?: string | null })
      .filter((v) => v.estado === "final")
      .map((v) => ({ finalizedBy: v.finalizedBy ?? undefined })),
    tratamientos: plan.docs
      .map((d) => d.data() as { estado?: string; tratamiento: string; realizado?: { uid: string } })
      .filter((i) => i.estado === "realizado" && i.realizado)
      .map((i) => ({ tratamiento: i.tratamiento, uid: i.realizado?.uid ?? "" })),
    presupuestos: presupuestos.docs.map((d) => ({ estado: d.data().estado as EstadoPresupuesto })),
  });
}

/** Indicadores clínicos de un mes `YYYY-MM` y del anterior, para compararlos. */
export function useIndicadoresClinicos(centroId: string | undefined, mes: string) {
  const [datos, setDatos] = useState<IndicadoresDelMes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    let vigente = true;
    setError(null);
    (async () => {
      try {
        const [actual, previo, usuarios] = await Promise.all([
          indicadoresDe(centroId, mes),
          indicadoresDe(centroId, mesAnterior(mes)),
          getDocs(query(collection(db, "users"), where("centroId", "==", centroId))),
        ]);
        const nombres: Record<string, string> = {};
        for (const u of usuarios.docs) nombres[u.id] = (u.data().nombreCompleto as string | undefined) ?? "Profesional";
        if (vigente) setDatos({ mes, actual, previo, nombres });
      } catch (err) {
        if (vigente) setError(mensajeError(err));
      }
    })();
    return () => {
      vigente = false;
    };
  }, [centroId, mes]);

  return { datos: datos?.mes === mes ? datos : null, error };
}
