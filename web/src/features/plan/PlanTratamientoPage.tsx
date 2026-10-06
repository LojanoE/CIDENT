import type { ItemPlan, Presupuesto } from "@cident/shared";
import { itemPlanSchema } from "@cident/shared";
import { Download, History, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
} from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerCatalogoTratamientos } from "../documentos/documentosApi";
import { HistorialDiente } from "../odontograma/HistorialDiente";
import { usePaciente } from "../pacientes/usePaciente";
import {
  agregarItem,
  descartar,
  desmarcar,
  eliminarItem,
  importarDesdePresupuesto,
  obtenerPresupuestosImportables,
} from "./planApi";
import { usePlan } from "./usePlan";

/** Pestaña «Plan» del paciente: tratamientos por hacer, hechos y descartados. */
export function PlanTratamientoPage() {
  const { paciente } = usePaciente();
  const { sesion } = useAuth();
  const toast = useToast();
  const { patientId, centroId } = paciente;
  const { items, error } = usePlan(patientId, centroId);

  const [tratamiento, setTratamiento] = useState("");
  const [pieza, setPieza] = useState("");
  const [errorForm, setErrorForm] = useState<string | undefined>();
  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [historialFdi, setHistorialFdi] = useState<number | null>(null);

  useEffect(() => {
    obtenerCatalogoTratamientos(centroId)
      .then((c) => setCatalogo(c.map((t) => t.nombre)))
      .catch(() => undefined); // El catálogo solo autocompleta.
    obtenerPresupuestosImportables(patientId, centroId)
      .then(setPresupuestos)
      .catch(() => undefined);
  }, [patientId, centroId]);

  if (!sesion) return null;
  const uid = sesion.uid;

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await accion();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  function alAgregar(e: FormEvent) {
    e.preventDefault();
    const r = itemPlanSchema.safeParse({ tratamiento, pieza });
    if (!r.success) {
      setErrorForm(r.error.issues[0]?.message);
      return;
    }
    setErrorForm(undefined);
    void ejecutar(async () => {
      await agregarItem(patientId, centroId, uid, r.data, items ?? []);
      setTratamiento("");
      setPieza("");
    });
  }

  if (error)
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  if (!items) return <Skeleton className="h-40 w-full" />;

  const pendientes = items.filter((i) => i.estado === "pendiente");
  const realizados = items.filter((i) => i.estado === "realizado");
  const descartados = items.filter((i) => i.estado === "descartado");
  const activos = pendientes.length + realizados.length;
  const porcentaje = activos === 0 ? 0 : Math.round((realizados.length / activos) * 100);
  const importables = presupuestos.filter((p) => !items.some((i) => i.origen?.budgetId === p.id));

  const nombre = (i: ItemPlan) => (i.pieza ? `${i.tratamiento} · pieza ${i.pieza}` : i.tratamiento);
  const fdiDe = (i: ItemPlan) => (i.pieza && /^\d{2}$/.test(i.pieza) ? Number(i.pieza) : null);

  function fila(i: ItemPlan, acciones: ReactNode) {
    const fdi = fdiDe(i);
    return (
      <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{nombre(i)}</span>
          {i.origen?.codigo && (
            <span className="ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-xs text-ink-soft">
              {i.origen.codigo}
            </span>
          )}
          {i.estado === "realizado" && i.realizado && (
            <span className="block text-13 text-ink-soft">
              {i.realizado.fecha}
              {i.realizado.nota ? ` — ${i.realizado.nota}` : ""}{" "}
              <Link to={`/pacientes/${patientId}/atenciones/${i.realizado.visitId}/odontograma`} className="underline">
                Ver atención
              </Link>
            </span>
          )}
        </span>
        {fdi !== null && (
          <Button size="sm" variant="ghost" onClick={() => setHistorialFdi(fdi)}>
            <History aria-hidden className="h-4 w-4" /> Historial
          </Button>
        )}
        {acciones}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Plan de tratamiento" />
        <CardBody className="space-y-3">
          <div>
            <div
              className="h-2 overflow-hidden rounded-full bg-accent-wash"
              role="img"
              aria-label={`${porcentaje}% realizado`}
            >
              <div className="h-full bg-accent" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-1 text-13 text-ink-soft">
              {realizados.length} de {activos} realizados
            </p>
          </div>

          <form onSubmit={alAgregar} className="flex flex-wrap items-end gap-2">
            <Field label="Tratamiento" error={errorForm} className="min-w-48 flex-1">
              <Input list="catalogo-plan" value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
            </Field>
            <datalist id="catalogo-plan">
              {catalogo.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Field label="Pieza (opcional)" className="w-32">
              <Input value={pieza} maxLength={10} onChange={(e) => setPieza(e.target.value)} placeholder="Ej. 16" />
            </Field>
            <Button type="submit" loading={ocupado}>
              <Plus aria-hidden className="h-4 w-4" /> Agregar
            </Button>
          </form>

          {importables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {importables.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="secondary"
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(async () => {
                      const n = await importarDesdePresupuesto(p, uid, items);
                      toast.ok(`Se importaron ${n} tratamientos del presupuesto ${p.codigoUnico}.`);
                    })
                  }
                >
                  <Download aria-hidden className="h-4 w-4" /> Importar presupuesto {p.codigoUnico}
                </Button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {items.length === 0 && (
        <EmptyState title="Sin plan todavía" description="Agrega tratamientos o importa un presupuesto." />
      )}

      {pendientes.length > 0 && (
        <Card>
          <CardHeader title={`Pendientes (${pendientes.length})`} />
          <CardBody>
            <ul className="divide-y divide-line">
              {pendientes.map((i) =>
                fila(
                  i,
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={ocupado}
                      onClick={() => void ejecutar(() => descartar(patientId, i.id))}
                    >
                      <X aria-hidden className="h-4 w-4" /> Descartar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Eliminar ${nombre(i)}`}
                      disabled={ocupado}
                      onClick={() => void ejecutar(() => eliminarItem(patientId, i.id))}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  </>,
                ),
              )}
            </ul>
          </CardBody>
        </Card>
      )}

      {realizados.length > 0 && (
        <Card>
          <CardHeader title={`Realizados (${realizados.length})`} />
          <CardBody>
            <ul className="divide-y divide-line">{realizados.map((i) => fila(i, <Badge tone="ok">Realizado</Badge>))}</ul>
          </CardBody>
        </Card>
      )}

      {descartados.length > 0 && (
        <Card>
          <CardHeader title={`Descartados (${descartados.length})`} />
          <CardBody>
            <ul className="divide-y divide-line">
              {descartados.map((i) =>
                fila(
                  i,
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() => void ejecutar(() => desmarcar(patientId, i.id))}
                  >
                    Reactivar
                  </Button>,
                ),
              )}
            </ul>
          </CardBody>
        </Card>
      )}

      <HistorialDiente
        patientId={patientId}
        centroId={centroId}
        fdi={historialFdi}
        plan={items}
        onCerrar={() => setHistorialFdi(null)}
      />
    </div>
  );
}
