import type { Gasto, Pago, Paciente, Presupuesto } from "@cident/shared";
import { cuentasPorCobrar, ingresosPorProfesional, resumenCaja } from "@cident/shared";
import { getDocs, query, where } from "firebase/firestore";
import { Ban, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { PageHeader } from "../../components/layout";
import { Badge, Button, Card, CardBody, EmptyState, Field, Input, Select, Skeleton, useToast } from "../../components/ui";
import { cn } from "../../lib/cn";
import { mensajeError } from "../../lib/mensajeError";
import { useProfesionalesDelCentro } from "../agenda/useAgenda";
import { pacientesCollection } from "../pacientes/pacientesApi";
import { AnularMovimientoDialog } from "../pagos/AnularMovimientoDialog";
import {
  ETIQUETA_CATEGORIA_GASTO,
  ETIQUETA_FORMA_PAGO,
  anularGasto,
  dinero,
  hoyIso,
  obtenerGastosDelRango,
  obtenerPagosDelRango,
  obtenerPresupuestosAceptados,
} from "../pagos/pagosApi";
import { GastoForm } from "./GastoForm";

type Periodo = "hoy" | "mes" | "rango";
type Pestana = "caja" | "profesional" | "cobrar" | "gastos";

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: "caja", label: "Caja" },
  { id: "profesional", label: "Por profesional" },
  { id: "cobrar", label: "Cuentas por cobrar" },
  { id: "gastos", label: "Gastos" },
];

function rangoDelMes(hoy: string): [string, string] {
  return [`${hoy.slice(0, 7)}-01`, `${hoy.slice(0, 7)}-31`];
}

function Cifra({ titulo, valor, tono }: { titulo: string; valor: number; tono?: "ok" | "danger" }) {
  return (
    <Card>
      <CardBody>
        <p className="text-13 text-ink-soft">{titulo}</p>
        <p className={cn("text-xl font-semibold", tono === "ok" && "text-ok", tono === "danger" && "text-danger")}>
          {dinero(valor)}
        </p>
      </CardBody>
    </Card>
  );
}

export function ContabilidadPage() {
  const { sesion } = useAuth();
  const toast = useToast();
  const centroId = sesion?.centroId;
  const { profesionales } = useProfesionalesDelCentro(centroId);

  const hoy = hoyIso();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desdeLibre, setDesdeLibre] = useState(rangoDelMes(hoy)[0]);
  const [hastaLibre, setHastaLibre] = useState(hoy);
  const [pestana, setPestana] = useState<Pestana>("caja");

  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [gastos, setGastos] = useState<Gasto[] | null>(null);
  const [aceptados, setAceptados] = useState<Presupuesto[] | null>(null);
  const [pacientes, setPacientes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [gastoAbierto, setGastoAbierto] = useState(false);
  const [aAnular, setAAnular] = useState<Gasto | null>(null);

  const [desde, hasta] = periodo === "hoy" ? [hoy, hoy] : periodo === "mes" ? rangoDelMes(hoy) : [desdeLibre, hastaLibre];

  const cargar = useCallback(async () => {
    if (!centroId || !desde || !hasta || desde > hasta) return;
    setError(null);
    try {
      const [p, g, a] = await Promise.all([
        obtenerPagosDelRango(centroId, desde, hasta),
        obtenerGastosDelRango(centroId, desde, hasta),
        obtenerPresupuestosAceptados(centroId),
      ]);
      setPagos(p);
      setGastos(g);
      setAceptados(a);
    } catch (err) {
      setError(mensajeError(err));
    }
  }, [centroId, desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!centroId) return;
    getDocs(query(pacientesCollection(), where("centroId", "==", centroId)))
      .then((snap) => {
        const mapa: Record<string, string> = {};
        for (const d of snap.docs) {
          const p = d.data() as Paciente;
          mapa[p.patientId] = `${p.apellidos} ${p.nombres}`;
        }
        setPacientes(mapa);
      })
      .catch(() => undefined);
  }, [centroId]);

  const nombrePaciente = (id: string) => pacientes[id] ?? id;
  const nombreProfesional = (uid: string) => profesionales?.find((u) => u.uid === uid)?.nombreCompleto ?? uid;

  const caja = useMemo(() => resumenCaja(pagos ?? [], gastos ?? []), [pagos, gastos]);
  const porProfesional = useMemo(() => ingresosPorProfesional(pagos ?? []), [pagos]);
  const porCobrar = useMemo(() => cuentasPorCobrar(aceptados ?? []), [aceptados]);
  const totalPorCobrar = porCobrar.reduce((a, c) => a + c.saldo, 0);

  const cargando = pagos === null || gastos === null || aceptados === null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Contabilidad"
        description="Ingresos por cobros de pacientes, cuentas por cobrar y gastos del centro."
        actions={
          <Button onClick={() => setGastoAbierto(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            Registrar gasto
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Período" className="w-40">
          <Select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            <option value="hoy">Hoy</option>
            <option value="mes">Este mes</option>
            <option value="rango">Rango</option>
          </Select>
        </Field>
        {periodo === "rango" && (
          <>
            <Field label="Desde">
              <Input type="date" value={desdeLibre} onChange={(e) => setDesdeLibre(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={hastaLibre} onChange={(e) => setHastaLibre(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      {desde > hasta && (
        <p role="alert" className="text-sm text-danger">
          La fecha inicial no puede ser posterior a la final.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div role="tablist" aria-label="Secciones de contabilidad" className="flex gap-1 overflow-x-auto border-b border-line">
        {PESTANAS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={pestana === t.id}
            onClick={() => setPestana(t.id)}
            className={cn(
              "-mb-px min-h-touch border-b-2 px-3 text-sm font-medium",
              pestana === t.id ? "border-accent text-accent" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <Skeleton className="h-48" />
      ) : (
        <div role="tabpanel">
          {pestana === "caja" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Cifra titulo="Ingresos" valor={caja.ingresos} tono="ok" />
                <Cifra titulo="Egresos" valor={caja.egresos} tono="danger" />
                <Cifra titulo="Balance" valor={caja.balance} tono={caja.balance >= 0 ? "ok" : "danger"} />
              </div>
              <Card>
                <CardBody className="space-y-2">
                  <h2 className="text-base font-semibold">Ingresos por forma de pago</h2>
                  <ul className="grid gap-1 text-sm sm:grid-cols-2">
                    {(Object.keys(ETIQUETA_FORMA_PAGO) as (keyof typeof ETIQUETA_FORMA_PAGO)[]).map((f) => (
                      <li key={f} className="flex justify-between">
                        <span className="text-ink-soft">{ETIQUETA_FORMA_PAGO[f]}</span>
                        <span className="font-medium">{dinero(caja.ingresosPorFormaPago[f] ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
              <section aria-label="Cobros del período" className="space-y-2">
                <h2 className="text-base font-semibold">Cobros del período</h2>
                {pagos.length === 0 ? (
                  <EmptyState title="Sin cobros en el período" />
                ) : (
                  <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                    {pagos.map((p) => (
                      <li
                        key={p.id}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm",
                          p.estado === "anulado" && "text-ink-soft line-through",
                        )}
                      >
                        <div>
                          <Link to={`/pacientes/${p.patientId}/pagos`} className="font-medium hover:underline">
                            {nombrePaciente(p.patientId)}
                          </Link>
                          <p className="text-13 text-ink-soft">
                            {p.fecha} · {p.codigoUnico} · {ETIQUETA_FORMA_PAGO[p.formaPago]} · {p.concepto}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.estado === "anulado" && <Badge tone="danger">Anulado</Badge>}
                          <span className="font-medium">{dinero(p.monto)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {pestana === "profesional" &&
            (porProfesional.length === 0 ? (
              <EmptyState title="Sin cobros en el período" />
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                {porProfesional.map((r) => (
                  <li key={r.profesionalUid} className="flex items-center justify-between gap-2 px-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{nombreProfesional(r.profesionalUid)}</p>
                      <p className="text-13 text-ink-soft">
                        {r.cobros} {r.cobros === 1 ? "cobro" : "cobros"}
                      </p>
                    </div>
                    <span className="font-semibold">{dinero(r.monto)}</span>
                  </li>
                ))}
              </ul>
            ))}

          {pestana === "cobrar" &&
            (porCobrar.length === 0 ? (
              <EmptyState title="Sin cuentas por cobrar" description="Todos los presupuestos aceptados están al día." />
            ) : (
              <div className="space-y-3">
                <p className="text-sm">
                  Total por cobrar: <strong className="text-base">{dinero(totalPorCobrar)}</strong>
                </p>
                <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                  {porCobrar.map((c) => (
                    <li key={c.patientId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                      <div>
                        <Link to={`/pacientes/${c.patientId}/pagos`} className="font-medium hover:underline">
                          {nombrePaciente(c.patientId)}
                        </Link>
                        <p className="text-13 text-ink-soft">
                          {c.presupuestos.map((p) => `${p.codigoUnico} (${dinero(p.saldo)})`).join(" · ")}
                        </p>
                      </div>
                      <span className="font-semibold">{dinero(c.saldo)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {pestana === "gastos" &&
            (gastos.length === 0 ? (
              <EmptyState title="Sin gastos en el período" />
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                {gastos.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className={g.estado === "anulado" ? "text-ink-soft line-through" : undefined}>
                      <p className="font-medium">{g.descripcion}</p>
                      <p className="text-13 text-ink-soft">
                        {g.fecha} · {ETIQUETA_CATEGORIA_GASTO[g.categoria]} · {ETIQUETA_FORMA_PAGO[g.formaPago]}
                      </p>
                      {g.estado === "anulado" && g.motivoAnulacion && (
                        <p className="text-13 no-underline">Anulado: {g.motivoAnulacion}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {g.estado === "anulado" ? (
                        <Badge tone="danger">Anulado</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setAAnular(g)}>
                          <Ban aria-hidden className="h-4 w-4" />
                          Anular
                        </Button>
                      )}
                      <span className="font-medium">{dinero(g.monto)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}

      <GastoForm open={gastoAbierto} onClose={() => setGastoAbierto(false)} onRegistrado={() => void cargar()} />
      <AnularMovimientoDialog
        open={aAnular !== null}
        titulo="Anular gasto"
        descripcion={aAnular ? `Se anulará «${aAnular.descripcion}» por ${dinero(aAnular.monto)}. Queda registrado.` : ""}
        onClose={() => setAAnular(null)}
        onConfirmar={async (motivo) => {
          if (!aAnular) return;
          await anularGasto({ gastoId: aAnular.id, motivo });
          toast.ok("Gasto anulado.");
          await cargar();
        }}
      />
    </div>
  );
}
