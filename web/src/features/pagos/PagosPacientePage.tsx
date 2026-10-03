import type { Pago, Presupuesto } from "@cident/shared";
import { saldoPresupuesto, sumarMontos } from "@cident/shared";
import { Ban, Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { Badge, Button, Card, CardBody, EmptyState, Skeleton, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerUrlDescarga } from "../adjuntos/adjuntosApi";
import { usePaciente } from "../pacientes/usePaciente";
import { AnularMovimientoDialog } from "./AnularMovimientoDialog";
import { PagoForm } from "./PagoForm";
import {
  ETIQUETA_FORMA_PAGO,
  anularPago,
  dinero,
  suscribirPagosDePaciente,
  suscribirPresupuestosAceptados,
} from "./pagosApi";

/** Pestaña «Pagos» del paciente: saldo por presupuesto aceptado, cobros y recibos. */
export function PagosPacientePage() {
  const { paciente } = usePaciente();
  const { sesion } = useAuth();
  const toast = useToast();
  const { patientId, centroId } = paciente;

  const [presupuestos, setPresupuestos] = useState<Presupuesto[] | null>(null);
  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [presupuestoInicial, setPresupuestoInicial] = useState<string | undefined>();
  const [aAnular, setAAnular] = useState<Pago | null>(null);

  useEffect(() => {
    if (!sesion) return;
    const alError = (err: unknown) => setError(mensajeError(err));
    const a = suscribirPresupuestosAceptados(patientId, centroId, setPresupuestos, alError);
    const b = suscribirPagosDePaciente(patientId, centroId, setPagos, alError);
    return () => {
      a();
      b();
    };
  }, [patientId, centroId, sesion]);

  const abrirRecibo = async (storagePath: string) => {
    try {
      window.open(await obtenerUrlDescarga(storagePath), "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (!presupuestos || !pagos) return <Skeleton className="h-48" />;

  const conSaldo = presupuestos.filter((p) => saldoPresupuesto(p.total, p.pagado) > 0);
  const saldoTotal = sumarMontos(conSaldo.map((p) => saldoPresupuesto(p.total, p.pagado)));

  const registrar = (budgetId?: string) => {
    setPresupuestoInicial(budgetId);
    setFormAbierto(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Saldo pendiente del paciente: <strong className="text-base">{dinero(saldoTotal)}</strong>
        </p>
        <Button onClick={() => registrar()}>
          <Plus aria-hidden className="h-4 w-4" />
          Registrar pago
        </Button>
      </div>

      <section aria-label="Presupuestos aceptados" className="grid gap-3 md:grid-cols-2">
        {presupuestos.length === 0 ? (
          <p className="text-sm text-ink-soft md:col-span-2">
            No hay presupuestos aceptados. Acepta un presupuesto desde la pestaña Documentos de la atención para cobrar
            por abonos, o registra un pago suelto.
          </p>
        ) : (
          presupuestos.map((p) => {
            const pagado = p.pagado ?? 0;
            const saldo = saldoPresupuesto(p.total, pagado);
            const progreso = p.total > 0 ? Math.min(100, Math.round((pagado / p.total) * 100)) : 0;
            return (
              <Card key={p.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{p.codigoUnico}</span>
                    {saldo === 0 ? <Badge tone="ok">Cancelado</Badge> : <Badge tone="warn">Con saldo</Badge>}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Pagado de ${p.codigoUnico}`}
                    aria-valuenow={progreso}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-bg"
                  >
                    <div className="h-full bg-accent" style={{ width: `${progreso}%` }} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-13">
                    <div>
                      <dt className="text-ink-soft">Total</dt>
                      <dd className="font-medium">{dinero(p.total)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-soft">Pagado</dt>
                      <dd className="font-medium">{dinero(pagado)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-soft">Saldo</dt>
                      <dd className="font-medium">{dinero(saldo)}</dd>
                    </div>
                  </dl>
                  {saldo > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => registrar(p.id)}>
                      Abonar
                    </Button>
                  )}
                </CardBody>
              </Card>
            );
          })
        )}
      </section>

      <section aria-label="Historial de pagos" className="space-y-2">
        <h2 className="text-base font-semibold">Historial</h2>
        {pagos.length === 0 ? (
          <EmptyState title="Sin pagos registrados" description="Los cobros del paciente aparecerán aquí." />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {pagos.map((p) => {
              const anulado = p.estado === "anulado";
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className={anulado ? "min-w-0 text-ink-soft line-through" : "min-w-0"}>
                    <p className="font-mono font-medium">
                      {p.codigoUnico} · {dinero(p.monto)}
                    </p>
                    <p className="text-13 text-ink-soft">
                      {p.fecha} · {ETIQUETA_FORMA_PAGO[p.formaPago]} · {p.concepto}
                    </p>
                    {anulado && p.motivoAnulacion && (
                      <p className="text-13 no-underline">Anulado: {p.motivoAnulacion}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {anulado && <Badge tone="danger">Anulado</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Descargar recibo ${p.codigoUnico}`}
                      onClick={() => abrirRecibo(p.archivo.storagePath)}
                    >
                      <Download aria-hidden className="h-4 w-4" />
                      Recibo
                    </Button>
                    {!anulado && (
                      <Button variant="ghost" size="sm" onClick={() => setAAnular(p)}>
                        <Ban aria-hidden className="h-4 w-4" />
                        Anular
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PagoForm
        open={formAbierto}
        onClose={() => setFormAbierto(false)}
        patientId={patientId}
        presupuestos={conSaldo}
        presupuestoInicial={presupuestoInicial}
        onRegistrado={abrirRecibo}
      />
      <AnularMovimientoDialog
        open={aAnular !== null}
        titulo="Anular pago"
        descripcion={
          aAnular
            ? `Se anulará el recibo ${aAnular.codigoUnico} por ${dinero(aAnular.monto)}. Queda registrado y el saldo del presupuesto se restaura.`
            : ""
        }
        onClose={() => setAAnular(null)}
        onConfirmar={async (motivo) => {
          if (!aAnular) return;
          await anularPago({ patientId, pagoId: aAnular.id, motivo });
          toast.ok("Pago anulado.");
        }}
      />
    </div>
  );
}
