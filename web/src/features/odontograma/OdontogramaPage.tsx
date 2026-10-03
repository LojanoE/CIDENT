import { Suspense, lazy, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { Badge, Card, CardBody, CardHeader, ConfirmarDialog, Spinner } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useEsEscritorio } from "../../lib/useMediaQuery";
import { soportaWebGL } from "../../lib/webgl";
import { useAtencion } from "../atenciones/useAtencion";
import { cuadranteInicial, cuadrantesDe } from "./geometria";
import { HigieneTabla } from "./HigieneTabla";
import { LeyendaOdontograma } from "./LeyendaOdontograma";
import { Odontograma } from "./Odontograma";
import type { SeleccionOdontograma } from "./Odontograma";
import { SelectorCuadrante } from "./SelectorCuadrante";
import { useOdontograma } from "./useOdontograma";
import { ZonaEditor } from "./ZonaEditor";
import { ErrorBoundary3D } from "./3d/ErrorBoundary3D";

// three.js pesa bastante: solo se descarga al abrir la vista 3D.
const Odontograma3D = lazy(() =>
  import("./3d/Odontograma3D").then((m) => ({ default: m.Odontograma3D })),
);

const CLAVE_VISTA = "cident.odontograma.vista";
const WEBGL = soportaWebGL();

function vistaInicial(): "2d" | "3d" {
  if (!WEBGL) return "2d";
  try {
    return localStorage.getItem(CLAVE_VISTA) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

const TIPOS = [
  { valor: "adulto", etiqueta: "Adulto (32)" },
  { valor: "infantil", etiqueta: "Infantil (20)" },
] as const;

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div>
      <p className="font-mono text-xl font-medium">{valor}</p>
      <p className="text-13 text-ink-soft">{etiqueta}</p>
    </div>
  );
}

export function OdontogramaPage() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const { sesion } = useAuth();
  const escritorio = useEsEscritorio();

  const { atencion } = useAtencion();
  const [seleccion, setSeleccion] = useState<SeleccionOdontograma | null>(null);
  const [cuadranteElegido, setCuadranteElegido] = useState<number | null>(null);
  const [vista, setVista] = useState<"2d" | "3d">(vistaInicial);

  function cambiarVista(nueva: "2d" | "3d") {
    setVista(nueva);
    try {
      localStorage.setItem(CLAVE_VISTA, nueva);
    } catch {
      // La preferencia es solo una comodidad.
    }
  }

  const soloLectura = atencion.estado !== "draft";

  const odo = useOdontograma({
    patientId: patientId ?? "",
    visitId: visitId ?? "",
    centroId: sesion?.centroId ?? "",
    uid: sesion?.uid ?? "",
    soloLectura,
  });

  if (!patientId || !visitId || !sesion) {
    return null;
  }

  if (odo.cargando) {
    return (
      <div className="p-6">
        <Spinner label="Cargando odontograma…" />
      </div>
    );
  }

  // Si el cuadrante elegido no existe en este tipo (p. ej. al pasar de adulto a infantil), se
  // vuelve al inicial sin efectos ni estado derivado.
  const cuadrante =
    cuadranteElegido !== null && cuadrantesDe(odo.tipo).includes(cuadranteElegido)
      ? cuadranteElegido
      : cuadranteInicial(odo.tipo);

  const blocker = odo.blocker;
  const dienteSeleccionado = seleccion ? odo.dientes[String(seleccion.fdi)] : undefined;
  const valorInicial = seleccion
    ? seleccion.zona
      ? dienteSeleccionado?.zonas[seleccion.zona]
      : dienteSeleccionado?.general
    : undefined;

  const estadoGuardado = odo.guardando ? "Guardando…" : odo.sucio ? "Cambios sin guardar" : "Guardado";
  const error = odo.error;

  return (
    <div className="space-y-4">
      <p role="status" className="text-sm text-ink-soft">
        {estadoGuardado}
      </p>

      {soloLectura && (
        <p className="rounded-md border border-line bg-surface p-3 text-sm text-ink-soft">
          Esta atención está finalizada y no se puede modificar.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span id="etiqueta-tipo" className="text-sm font-medium">
          Tipo de dentición
        </span>
        <div
          role="group"
          aria-labelledby="etiqueta-tipo"
          className="inline-flex overflow-hidden rounded-md border border-input bg-surface"
        >
          {TIPOS.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              disabled={soloLectura}
              aria-pressed={odo.tipo === valor}
              onClick={() => odo.setTipo(valor)}
              className={cn(
                "min-h-touch px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
                odo.tipo === valor ? "bg-accent text-accent-ink" : "text-ink hover:bg-accent-wash",
              )}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Tipo de vista"
                className="inline-flex overflow-hidden rounded-md border border-input bg-surface"
              >
                {(["2d", "3d"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={v === "3d" && !WEBGL}
                    aria-pressed={vista === v}
                    onClick={() => cambiarVista(v)}
                    className={cn(
                      "min-h-touch px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
                      vista === v ? "bg-accent text-accent-ink" : "text-ink hover:bg-accent-wash",
                    )}
                  >
                    {v === "2d" ? "2D" : "3D"}
                  </button>
                ))}
              </div>
              {!WEBGL && (
                <span className="text-13 text-ink-soft">Este navegador no admite gráficos 3D (WebGL).</span>
              )}
            </div>
            {vista === "3d" ? (
              <ErrorBoundary3D
                alternativa={
                  <p className="text-sm text-ink-soft">
                    No se pudo cargar la vista 3D. Verifica tu conexión o vuelve a la vista 2D.
                  </p>
                }
              >
                <Suspense fallback={<Spinner label="Cargando vista 3D…" />}>
                  <Odontograma3D
                    tipo={odo.tipo}
                    dientes={odo.dientes}
                    soloLectura={soloLectura}
                    seleccion={seleccion}
                    onZonaClick={(fdi, zona) => setSeleccion({ fdi, zona })}
                    onGeneralClick={(fdi) => setSeleccion({ fdi, zona: null })}
                  />
                </Suspense>
              </ErrorBoundary3D>
            ) : (
              <>
                {!escritorio && (
                  <SelectorCuadrante tipo={odo.tipo} activo={cuadrante} onCambiar={setCuadranteElegido} />
                )}
                <Odontograma
                  tipo={odo.tipo}
                  dientes={odo.dientes}
                  soloLectura={soloLectura}
                  seleccion={seleccion}
                  cuadrante={escritorio ? null : cuadrante}
                  onZonaClick={(fdi, zona) => setSeleccion({ fdi, zona })}
                  onGeneralClick={(fdi) => setSeleccion({ fdi, zona: null })}
                />
                <p className="text-13 text-ink-soft">
                  {soloLectura
                    ? "Toca una zona para ver su detalle."
                    : "Toca una zona del diente para editarla. Dentro del editor puedes cambiar a «Todo el diente»."}
                </p>
              </>
            )}
            <LeyendaOdontograma abierta={escritorio} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="CPO" />
            <CardBody>
              <div className="grid grid-cols-4 gap-2">
                <Dato etiqueta="Cariados" valor={odo.cpo.c} />
                <Dato etiqueta="Perdidos" valor={odo.cpo.p} />
                <Dato etiqueta="Obturados" valor={odo.cpo.o} />
                <Dato etiqueta="Total" valor={odo.cpo.total} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Promedios de higiene" />
            <CardBody>
              <div className="grid grid-cols-3 gap-2">
                <Dato etiqueta="Placa" valor={odo.indicadores.placa} />
                <Dato etiqueta="Cálculo" valor={odo.indicadores.calculo} />
                <Dato etiqueta="Gingivitis" valor={odo.indicadores.gingivitis} />
              </div>
            </CardBody>
          </Card>

          {odo.sucio && !odo.guardando && !soloLectura && (
            <Badge tone="warn">Cambios pendientes de autoguardado</Badge>
          )}
        </div>
      </div>

      <section aria-labelledby="titulo-higiene" className="space-y-2">
        <h2 id="titulo-higiene" className="text-base font-semibold">
          Índices de higiene por diente
        </h2>
        <HigieneTabla
          dientes={odo.higiene}
          soloLectura={soloLectura}
          onCambiar={(fdi, indicador, valor) => odo.setHigiene(fdi, indicador, valor)}
        />
      </section>

      <ZonaEditor
        abierto={seleccion !== null}
        fdi={seleccion?.fdi ?? null}
        zona={seleccion?.zona ?? null}
        valorInicial={valorInicial}
        soloLectura={soloLectura}
        onCambiarZona={(zona) => setSeleccion((s) => (s ? { ...s, zona } : s))}
        onGuardar={(valor) => {
          if (!seleccion) return;
          if (seleccion.zona) {
            odo.setZona(seleccion.fdi, seleccion.zona, valor);
          } else {
            odo.setGeneral(seleccion.fdi, valor);
          }
          setSeleccion(null);
        }}
        onLimpiar={() => {
          if (!seleccion) return;
          if (seleccion.zona) {
            odo.clearZona(seleccion.fdi, seleccion.zona);
          } else {
            odo.clearGeneral(seleccion.fdi);
          }
          setSeleccion(null);
        }}
        onCerrar={() => setSeleccion(null)}
      />

      <ConfirmarDialog
        open={blocker.state === "blocked"}
        title="Hay cambios sin guardar"
        description="Hay cambios sin guardar. ¿Deseas salir de todos modos?"
        cancelLabel="Seguir editando"
        confirmLabel="Salir sin guardar"
        variant="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
