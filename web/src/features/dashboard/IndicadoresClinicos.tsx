import { mesAnterior, mesSiguiente, variacion, type ConteoProfesional } from "@cident/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardBody, Skeleton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { hoyLocal } from "../agenda/fechas";
import { useIndicadoresClinicos } from "./useIndicadoresClinicos";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function nombreMes(mes: string) {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
}

/** Flecha de tendencia contra el mes anterior; `masEsMejor` decide el color. */
function Tendencia({ actual, previo, masEsMejor, sufijo = "" }: { actual: number | null; previo: number | null; masEsMejor: boolean; sufijo?: string }) {
  const dif = variacion(actual, previo);
  if (dif === null || dif === 0) return <span className="text-13 text-ink-soft">= mes anterior</span>;
  const sube = dif > 0;
  const bueno = sube === masEsMejor;
  return (
    <span className={cn("text-13", bueno ? "text-ok" : "text-danger")}>
      {sube ? "▲" : "▼"} {Math.abs(dif)}
      {sufijo} vs. mes anterior
    </span>
  );
}

function Indicador({ etiqueta, valor, children }: { etiqueta: string; valor: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <p className="text-13 text-ink-soft">{etiqueta}</p>
      <p className="text-2xl font-semibold">{valor}</p>
      {children}
    </div>
  );
}

function BarrasProfesional({ titulo, filas, nombres }: { titulo: string; filas: ConteoProfesional[]; nombres: Record<string, string> }) {
  const maximo = Math.max(...filas.map((f) => f.total), 0);
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-ink-soft">{titulo}</h4>
      {filas.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin datos este mes.</p>
      ) : (
        <ul className="space-y-1.5">
          {filas.map((f) => (
            <li key={f.uid || "sin"} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{nombres[f.uid] ?? "Sin asignar"}</span>
                <span className="font-medium">{f.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-line">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(f.total / maximo) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function IndicadoresClinicos({ centroId }: { centroId: string | undefined }) {
  const mesActual = hoyLocal().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const { datos, error } = useIndicadoresClinicos(centroId, mes);

  return (
    <section aria-label="Indicadores clínicos" className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Indicadores clínicos</h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" aria-label="Mes anterior" onClick={() => setMes(mesAnterior(mes))}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm capitalize">{nombreMes(mes)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mes siguiente"
            disabled={mes >= mesActual}
            onClick={() => setMes(mesSiguiente(mes))}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!error && !datos && <Skeleton className="h-40" />}
      {datos && (
        <Card>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicador etiqueta="Inasistencia" valor={pct(datos.actual.inasistencia)}>
                <Tendencia actual={datos.actual.inasistencia} previo={datos.previo.inasistencia} masEsMejor={false} sufijo=" pts" />
              </Indicador>
              <Indicador etiqueta="Pacientes nuevos" valor={String(datos.actual.pacientesNuevos)}>
                <Tendencia actual={datos.actual.pacientesNuevos} previo={datos.previo.pacientesNuevos} masEsMejor />
              </Indicador>
              <Indicador etiqueta="Atenciones finalizadas" valor={String(datos.actual.atenciones)}>
                <Tendencia actual={datos.actual.atenciones} previo={datos.previo.atenciones} masEsMejor />
              </Indicador>
              <Indicador etiqueta="Aceptación de presupuestos" valor={pct(datos.actual.aceptacion)}>
                <Tendencia actual={datos.actual.aceptacion} previo={datos.previo.aceptacion} masEsMejor sufijo=" pts" />
              </Indicador>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <BarrasProfesional titulo="Atenciones por profesional" filas={datos.actual.atencionesPorProfesional} nombres={datos.nombres} />
              <BarrasProfesional titulo="Tratamientos por profesional" filas={datos.actual.tratamientosPorProfesional} nombres={datos.nombres} />
              <div>
                <h4 className="mb-2 text-sm font-medium text-ink-soft">Tratamientos más realizados</h4>
                {datos.actual.topTratamientos.length === 0 ? (
                  <p className="text-sm text-ink-soft">Sin datos este mes.</p>
                ) : (
                  <ol className="space-y-1 text-sm">
                    {datos.actual.topTratamientos.map((t) => (
                      <li key={t.tratamiento} className="flex justify-between gap-2">
                        <span className="truncate capitalize">{t.tratamiento}</span>
                        <span className="font-medium">{t.total}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </section>
  );
}
