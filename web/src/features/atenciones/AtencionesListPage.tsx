import type { Atencion } from "@cident/shared";
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataList, EmptyState, Skeleton, estiloBoton } from "../../components/ui";
import type { Columna } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { usePaciente } from "../pacientes/usePaciente";
import { atencionesCollection } from "./atencionesApi";

function EstadoAtencion({ atencion }: { atencion: Atencion }) {
  return atencion.estado === "final" ? (
    <Badge tone="ok">Finalizada</Badge>
  ) : (
    <Badge tone="warn">Borrador</Badge>
  );
}

const COLUMNAS: Columna<Atencion>[] = [
  { id: "fecha", header: "Fecha", cell: (a) => <span className="font-mono">{a.fecha}</span> },
  { id: "motivo", header: "Motivo", cell: (a) => a.motivo || "—" },
  { id: "estado", header: "Estado", cell: (a) => <EstadoAtencion atencion={a} /> },
];

/** Pestaña «Atenciones»: historial del paciente, la más reciente primero. */
export function AtencionesListPage() {
  const { paciente } = usePaciente();
  const [atenciones, setAtenciones] = useState<Atencion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      atencionesCollection(paciente.patientId),
      where("centroId", "==", paciente.centroId),
      orderBy("fecha", "desc"),
    );
    return onSnapshot(
      q,
      (snap) => setAtenciones(snap.docs.map((d) => d.data() as Atencion)),
      (err) => setError(mensajeError(err)),
    );
  }, [paciente.patientId, paciente.centroId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (atenciones === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (atenciones.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList aria-hidden className="h-8 w-8" />}
        title="Sin atenciones todavía"
        description="Registra la primera atención de este paciente."
        action={
          <Link to={`/pacientes/${paciente.patientId}/atenciones/nueva`} className={estiloBoton()}>
            <Plus aria-hidden className="h-4 w-4" />
            Nueva atención
          </Link>
        }
      />
    );
  }

  return (
    <DataList
      caption="Atenciones del paciente"
      items={atenciones}
      columns={COLUMNAS}
      rowKey={(a) => a.visitId}
      rowHref={(a) => `/pacientes/${paciente.patientId}/atenciones/${a.visitId}`}
      renderCard={(a) => (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{a.fecha}</span>
              <EstadoAtencion atencion={a} />
            </div>
            <p className="truncate text-sm text-ink-soft">{a.motivo || "Sin motivo registrado"}</p>
          </div>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink-soft" />
        </div>
      )}
    />
  );
}
