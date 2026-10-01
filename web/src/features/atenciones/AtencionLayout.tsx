import type { Atencion } from "@cident/shared";
import { Ban, CheckCircle2, ClipboardList, FileText, Lock, Paperclip, Stethoscope, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import {
  Badge,
  Button,
  ConfirmarDialog,
  Dialog,
  EmptyState,
  Field,
  Skeleton,
  Tabs,
  Textarea,
  estiloBoton,
  useToast,
} from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import {
  anularAtencion,
  eliminarAtencion,
  finalizarAtencion,
  obtenerAtencion,
  reabrirAtencion,
} from "./atencionesApi";
import { AtencionContext, type ContextoAtencion } from "./useAtencion";

/** «hace 5 min», «hace 2 h»… para el indicador de último guardado. */
function hace(iso: string | undefined): string | null {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return null;
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `el ${iso.slice(0, 10)}`;
}

type Accion = "finalizar" | "reabrir" | "eliminar" | "anular";

/** Revisión suave previa a finalizar: informa, no bloquea. */
function checklist(a: Atencion): { texto: string; ok: boolean }[] {
  return [
    { texto: "Motivo de consulta completado", ok: a.motivo.trim().length > 0 },
    { texto: "Examen estomatognático completado", ok: a.examenEstomatognatico.trim().length > 0 },
  ];
}

/**
 * Marco de una atención existente: título, barra de estado (finalizar / reabrir / eliminar / anular,
 * visible en las cuatro pestañas) y las pestañas (Ficha, Odontograma, Documentos, Adjuntos). Carga la
 * atención una vez y la comparte con las pestañas por contexto.
 * No monta ninguna guarda de cambios: la única vive en la Ficha, porque `useBlocker` es único por router.
 */
export function AtencionLayout() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const { sesion } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [atencion, setAtencion] = useState<Atencion | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const guardadoPendiente = useRef<(() => Promise<boolean>) | null>(null);

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
  const registrarGuardadoPendiente = useCallback((fn: (() => Promise<boolean>) | null) => {
    guardadoPendiente.current = fn;
  }, []);
  const contexto = useMemo<ContextoAtencion | null>(
    () => (atencion ? { atencion, alActualizar, registrarGuardadoPendiente } : null),
    [atencion, alActualizar, registrarGuardadoPendiente],
  );

  const cerrarDialogo = () => {
    setAccion(null);
    setMotivoAnulacion("");
  };

  const recargar = async () => {
    if (!patientId || !visitId) return;
    const actualizada = await obtenerAtencion(patientId, visitId);
    if (actualizada) setAtencion(actualizada);
  };

  const ejecutar = async () => {
    if (!patientId || !visitId || !sesion || !accion) return;
    setProcesando(true);
    try {
      if (accion === "finalizar") {
        // Si la Ficha tiene cambios sin guardar se guardan primero; si no son válidos, no se finaliza.
        if (guardadoPendiente.current && !(await guardadoPendiente.current())) {
          cerrarDialogo();
          toast.error("Corrige los errores de la Ficha antes de finalizar.");
          return;
        }
        await finalizarAtencion(patientId, visitId, sesion.uid);
        await recargar();
        toast.ok("Atención finalizada. Si necesitas corregir algo, usa «Reabrir para editar».");
      } else if (accion === "reabrir") {
        await reabrirAtencion(patientId, visitId, sesion.uid);
        await recargar();
        toast.ok("Atención reabierta: vuelve a ser un borrador editable.");
      } else if (accion === "eliminar") {
        await eliminarAtencion(patientId, visitId);
        toast.ok("Borrador eliminado.");
        navigate(`/pacientes/${patientId}/atenciones`, { replace: true });
        return;
      } else {
        await anularAtencion(patientId, visitId, motivoAnulacion.trim());
        await recargar();
        toast.ok("Atención anulada.");
      }
      cerrarDialogo();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setProcesando(false);
    }
  };

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
  const guardado = hace(atencion.updatedAt ?? atencion.createdAt);

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
          </h2>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-3">
            {atencion.estado === "draft" && <Badge tone="warn">Borrador</Badge>}
            {atencion.estado === "final" && (
              <Badge tone="ok" icon={<Lock aria-hidden className="h-3 w-3" />}>
                Finalizada
              </Badge>
            )}
            {atencion.estado === "anulada" && (
              <Badge tone="danger" icon={<Ban aria-hidden className="h-3 w-3" />}>
                Anulada
              </Badge>
            )}
            {atencion.estado === "draft" && (
              <span className="text-13 text-ink-soft">
                Se edita libremente.{guardado ? ` Último guardado ${guardado}.` : ""}
              </span>
            )}
            {atencion.estado === "final" && (
              <span className="text-13 text-ink-soft">Solo lectura. Reábrela si necesitas corregirla.</span>
            )}

            <div className="ml-auto flex flex-wrap gap-2">
              {atencion.estado === "draft" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setAccion("eliminar")}>
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Eliminar
                  </Button>
                  <Button size="sm" onClick={() => setAccion("finalizar")}>
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                    Finalizar atención
                  </Button>
                </>
              )}
              {atencion.estado === "final" && (
                <>
                  {sesion?.rol === "admin" && (
                    <Button variant="ghost" size="sm" onClick={() => setAccion("anular")}>
                      <Ban aria-hidden className="h-4 w-4" />
                      Anular
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setAccion("reabrir")}>
                    Reabrir para editar
                  </Button>
                </>
              )}
            </div>
          </div>

          {atencion.estado === "anulada" && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              Atención anulada{atencion.anuladaAt ? ` el ${atencion.anuladaAt.slice(0, 10)}` : ""}.
              {atencion.motivoAnulacion ? ` Motivo: ${atencion.motivoAnulacion}` : ""}
            </p>
          )}
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

      <ConfirmarDialog
        open={accion === "finalizar"}
        title="¿Finalizar esta atención?"
        description={
          <div className="space-y-2">
            <p>
              Finalizar cierra la atención como registro clínico: quedan bloqueados la Ficha, el odontograma, los
              documentos y los adjuntos hasta que alguien del centro la reabra.
            </p>
            <ul className="space-y-1">
              {checklist(atencion).map((item) => (
                <li key={item.texto} className={item.ok ? "text-ok" : "text-warn"}>
                  {item.ok ? "✓" : "•"} {item.texto}
                </li>
              ))}
            </ul>
            <p>Podrás reabrirla si necesitas corregir algo.</p>
          </div>
        }
        confirmLabel="Sí, finalizar"
        loading={procesando}
        onCancel={cerrarDialogo}
        onConfirm={ejecutar}
      />
      <ConfirmarDialog
        open={accion === "reabrir"}
        title="¿Reabrir para editar?"
        description="La atención vuelve a ser un borrador editable. Queda registrado quién la reabrió y cuándo."
        confirmLabel="Reabrir"
        loading={procesando}
        onCancel={cerrarDialogo}
        onConfirm={ejecutar}
      />
      <ConfirmarDialog
        open={accion === "eliminar"}
        title="¿Eliminar este borrador?"
        description="Se borrará la atención y su odontograma. Si venía de una cita, la cita vuelve a quedar pendiente. No se puede deshacer."
        confirmLabel="Eliminar borrador"
        variant="danger"
        loading={procesando}
        onCancel={cerrarDialogo}
        onConfirm={ejecutar}
      />
      <Dialog
        open={accion === "anular"}
        onClose={cerrarDialogo}
        title="Anular atención"
        description="La atención no se borra: queda visible, en solo lectura y con el motivo. No se puede deshacer."
        actions={
          <>
            <Button variant="secondary" onClick={cerrarDialogo} disabled={procesando}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={procesando}
              disabled={motivoAnulacion.trim().length < 5}
              onClick={ejecutar}
            >
              Anular atención
            </Button>
          </>
        }
      >
        <Field label="Motivo de la anulación" hint="Mínimo 5 caracteres.">
          <Textarea rows={3} value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
        </Field>
      </Dialog>
    </AtencionContext.Provider>
  );
}
