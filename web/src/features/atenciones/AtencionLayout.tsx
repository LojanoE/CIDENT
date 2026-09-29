import type { Atencion } from "@cident/shared";
import { ClipboardList, FileText, Paperclip, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { EmptyState, Skeleton, Tabs, estiloBoton } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerAtencion } from "./atencionesApi";
import { AtencionContext, type ContextoAtencion } from "./useAtencion";

/**
 * Marco de una atención existente: título, estado y las cuatro pestañas (Ficha, Odontograma,
 * Documentos, Adjuntos). Carga la atención una vez y la comparte con las pestañas por contexto.
 * No monta ninguna guarda de cambios: la única vive en la Ficha, porque `useBlocker` es único por router.
 */
export function AtencionLayout() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const [atencion, setAtencion] = useState<Atencion | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !visitId) return;
    let vigente = true;
    setAtencion(undefined);
    obtenerAtencion(patientId, visitId)
      .then((a) => vigente && setAtencion(a))
      .catch((err) => vigente && setError(mensajeError(err)));
    return () => {
      vigente = false;
    };
  }, [patientId, visitId]);

  const alActualizar = useCallback((nueva: Atencion) => setAtencion(nueva), []);
  const contexto = useMemo<ContextoAtencion | null>(
    () => (atencion ? { atencion, alActualizar } : null),
    [atencion, alActualizar],
  );

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (atencion === undefined) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-11" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (atencion === null || !contexto) {
    return (
      <EmptyState
        icon={<ClipboardList aria-hidden className="h-8 w-8" />}
        title="Atención no encontrada"
        description="Puede que se haya eliminado o que pertenezca a otro centro."
        action={
          <Link to={`/pacientes/${patientId}/atenciones`} className={estiloBoton()}>
            Volver a las atenciones
          </Link>
        }
      />
    );
  }

  const base = `/pacientes/${patientId}/atenciones/${visitId}`;

  return (
    <AtencionContext.Provider value={contexto}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Link
            to={`/pacientes/${patientId}/atenciones`}
            className="text-13 text-ink-soft hover:text-ink"
          >
            Todas las atenciones
          </Link>
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold">
            <span>Atención del</span>
            <span className="font-mono">{atencion.fecha}</span>
            {atencion.estado === "final" && (
              <span className="text-sm font-normal text-ink-soft">(finalizada)</span>
            )}
          </h2>
        </div>

        <Tabs
          label="Secciones de la atención"
          items={[
            { to: base, label: "Ficha", end: true, icon: <Stethoscope aria-hidden className="h-4 w-4" /> },
            { to: `${base}/odontograma`, label: "Odontograma", icon: <ClipboardList aria-hidden className="h-4 w-4" /> },
            { to: `${base}/documentos`, label: "Documentos", icon: <FileText aria-hidden className="h-4 w-4" /> },
            { to: `${base}/adjuntos`, label: "Adjuntos", icon: <Paperclip aria-hidden className="h-4 w-4" /> },
          ]}
        />

        <Outlet />
      </div>
    </AtencionContext.Provider>
  );
}
