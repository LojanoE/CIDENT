import { ocupaFranja, rangoDelDia, type Cita, type EstadoCita } from "@cident/shared";
import { collection, collectionGroup, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { ArrowRight, UserPlus, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { Badge, Card, CardBody, EmptyState, Skeleton, estiloBoton } from "../../components/ui";
import { PageHeader } from "../../components/layout";
import { cn } from "../../lib/cn";
import { appointmentsCollection } from "../agenda/agendaApi";
import { ETIQUETA_ESTADO } from "../agenda/estados";
import { useCitasDelRango } from "../agenda/useAgenda";
import { ETIQUETA_FORMA_PAGO, dinero } from "../pagos/pagosApi";
import { GraficoIngresos } from "./GraficoIngresos";
import { IndicadoresClinicos } from "./IndicadoresClinicos";
import { useResumenFinanciero } from "./useResumenFinanciero";
import { useCentroActual } from "../centros/centrosApi";
import { hoyLocal } from "../agenda/fechas";
import { mensajeError } from "../../lib/mensajeError";

interface Contadores {
  pacientes: number;
  atenciones: number;
  borradores: number;
  citasHoy: number;
}

function useContadores(centroId: string | undefined) {
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    setContadores(null);
    setError(null);
    (async () => {
      try {
        const { inicio, fin } = rangoDelDia(hoyLocal());
        const [pacientesSnap, atencionesSnap, borradoresSnap, citasSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "patients"), where("centroId", "==", centroId))),
          getCountFromServer(query(collectionGroup(db, "visits"), where("centroId", "==", centroId))),
          getCountFromServer(
            query(
              collectionGroup(db, "visits"),
              where("centroId", "==", centroId),
              where("estado", "==", "draft"),
            ),
          ),
          // Las de hoy son pocas: se leen y se descartan las liberadas (canceladas/ausentes)
          // en el cliente, así no hace falta un índice extra por estado.
          getDocs(
            query(
              appointmentsCollection(),
              where("centroId", "==", centroId),
              where("inicio", ">=", inicio),
              where("inicio", "<", fin),
            ),
          ),
        ]);
        setContadores({
          pacientes: pacientesSnap.data().count,
          atenciones: atencionesSnap.data().count,
          borradores: borradoresSnap.data().count,
          citasHoy: citasSnap.docs.filter((d) => ocupaFranja((d.data() as Cita).estado)).length,
        });
      } catch (err) {
        setError(mensajeError(err));
      }
    })();
  }, [centroId]);

  return { contadores, error };
}

export function DashboardPage() {
  const { sesion } = useAuth();
  const { contadores, error } = useContadores(sesion?.centroId);
  const { nombre: nombreCentro } = useCentroActual(sesion?.centroId);
  const { resumen, error: errorFinanzas } = useResumenFinanciero(sesion?.centroId);
  const [diaHoy] = useState(hoyLocal);
  const { inicio, fin } = rangoDelDia(diaHoy);
  const { citas, error: errorCitas } = useCitasDelRango(sesion?.centroId, inicio, fin);
  const citasHoy = (citas ?? []).filter((c) => ocupaFranja(c.estado));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Inicio"
        description={nombreCentro ? `Resumen de ${nombreCentro}` : "Resumen del centro"}
        actions={
          <>
            <Link to="/pacientes" className={estiloBoton({ variant: "secondary" })}>
              <Users aria-hidden className="h-4 w-4" />
              Ver pacientes
            </Link>
            <Link to="/pacientes/nuevo" className={estiloBoton()}>
              <UserPlus aria-hidden className="h-4 w-4" />
              Nuevo paciente
            </Link>
          </>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && !contadores && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {contadores && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaContador etiqueta="Citas de hoy" valor={contadores.citasHoy} to="/agenda" />
          <TarjetaContador etiqueta="Pacientes" valor={contadores.pacientes} to="/pacientes" />
          <TarjetaContador etiqueta="Atenciones totales" valor={contadores.atenciones} />
          <TarjetaContador
            etiqueta="Borradores pendientes"
            valor={contadores.borradores}
            resaltar={contadores.borradores > 0}
          />
        </div>
      )}

      <section aria-label="Finanzas del mes" className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Finanzas del mes</h2>
          <Link to="/contabilidad" className="text-sm text-accent hover:underline">
            Ver contabilidad →
          </Link>
        </div>
        {errorFinanzas && (
          <p role="alert" className="text-sm text-danger">
            {errorFinanzas}
          </p>
        )}
        {!errorFinanzas && !resumen && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}
        {resumen && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TarjetaContador etiqueta="Cobrado hoy" valor={dinero(resumen.cobradoHoy)} to="/contabilidad" />
              <TarjetaContador etiqueta="Cobrado este mes" valor={dinero(resumen.caja.ingresos)} to="/contabilidad" />
              <TarjetaContador
                etiqueta="Balance del mes"
                valor={dinero(resumen.caja.balance)}
                tono={resumen.caja.balance < 0 ? "danger" : "ok"}
                detalle={`Egresos ${dinero(resumen.caja.egresos)}`}
                to="/contabilidad"
              />
              <TarjetaContador
                etiqueta="Por cobrar"
                valor={dinero(resumen.porCobrar)}
                resaltar={resumen.porCobrar > 0}
                to="/contabilidad"
              />
            </div>
            <Card>
              <CardBody>
                <h3 className="mb-3 text-sm font-medium text-ink-soft">Ingresos por día</h3>
                <GraficoIngresos hoy={resumen.hoy} porDia={resumen.caja.ingresosPorDia} />
              </CardBody>
            </Card>
          </>
        )}
      </section>

      <IndicadoresClinicos centroId={sesion?.centroId} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section aria-label="Citas de hoy" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Citas de hoy</h2>
            <Link to="/agenda" className="text-sm text-accent hover:underline">
              Ver agenda →
            </Link>
          </div>
          {errorCitas ? (
            <p role="alert" className="text-sm text-danger">
              {errorCitas}
            </p>
          ) : !citas ? (
            <Skeleton className="h-32" />
          ) : citasHoy.length === 0 ? (
            <EmptyState title="Sin citas hoy" description="Las citas agendadas para hoy aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {citasHoy.map((c) => (
                <li key={c.appointmentId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      <span className="font-mono">{c.inicio.slice(11, 16)}</span> · {c.pacienteNombre}
                    </p>
                    <p className="truncate text-13 text-ink-soft">{c.profesionalNombre}</p>
                  </div>
                  <Badge tone={tonoCita(c.estado)}>{ETIQUETA_ESTADO[c.estado]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Últimos cobros" className="space-y-2">
          <h2 className="text-base font-semibold">Últimos cobros</h2>
          {errorFinanzas ? null : !resumen ? (
            <Skeleton className="h-32" />
          ) : resumen.ultimosCobros.length === 0 ? (
            <EmptyState title="Sin cobros este mes" description="Los pagos registrados aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {resumen.ultimosCobros.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/pacientes/${p.patientId}/pagos`}
                    className="flex min-h-touch items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-accent-wash"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{resumen.nombres[p.patientId] ?? "Paciente"}</p>
                      <p className="truncate text-13 text-ink-soft">
                        {p.fecha} · {ETIQUETA_FORMA_PAGO[p.formaPago]} · {p.codigoUnico}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-medium">{dinero(p.monto)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {resumen && resumen.mayoresSaldos.length > 0 && (
        <section aria-label="Mayores saldos pendientes" className="mt-6 space-y-2">
          <h2 className="text-base font-semibold">Mayores saldos pendientes</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {resumen.mayoresSaldos.map((c) => (
              <li key={c.patientId}>
                <Link
                  to={`/pacientes/${c.patientId}/pagos`}
                  className="flex min-h-touch items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-accent-wash"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{resumen.nombres[c.patientId] ?? "Paciente"}</p>
                    <p className="truncate text-13 text-ink-soft">
                      {c.presupuestos.map((p) => p.codigoUnico).join(", ")}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono font-medium text-warn">{dinero(c.saldo)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function tonoCita(estado: EstadoCita): "neutral" | "accent" | "ok" | "warn" | "danger" {
  if (estado === "confirmada") return "accent";
  if (estado === "atendida") return "ok";
  return "warn";
}

function TarjetaContador({
  etiqueta,
  valor,
  to,
  resaltar,
  tono,
  detalle,
}: {
  etiqueta: string;
  valor: number | string;
  to?: string;
  resaltar?: boolean;
  tono?: "ok" | "danger";
  detalle?: string;
}) {
  const contenido: ReactNode = (
    <>
      <p className="text-sm text-ink-soft">{etiqueta}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-medium",
          resaltar && "text-warn",
          tono === "ok" && "text-ok",
          tono === "danger" && "text-danger",
        )}
      >
        {valor}
      </p>
      {detalle && <p className="text-13 text-ink-soft">{detalle}</p>}
      {to && (
        <ArrowRight aria-hidden className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
      )}
    </>
  );
  const clases = "relative block rounded-lg border border-line bg-surface p-4 shadow-card";

  return to ? (
    <Link to={to} className={cn(clases, "min-h-touch transition-colors hover:bg-accent-wash")}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
