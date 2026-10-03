import { fechaIsoSchema, ocupaFranja, rangoDeLaSemana, rangoDelDia, sumarDias, type Cita } from "@cident/shared";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { PageHeader } from "../../components/layout";
import { Button, EmptyState, Input, Skeleton, estiloBoton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useEnLinea } from "../../lib/useEnLinea";
import { useEsEscritorio } from "../../lib/useMediaQuery";
import { CitaSheet, type CitaInicial } from "./CitaSheet";
import { SelectorProfesional } from "./SelectorProfesional";
import { ListaDia, VistaDia } from "./VistaDia";
import { VistaSemana } from "./VistaSemana";
import { etiquetaDiaLarga, hoyLocal } from "./fechas";
import { useCitasDelRango, useProfesionalesDelCentro } from "./useAgenda";

type Vista = "dia" | "semana";

interface EstadoSheet {
  cita: Cita | null;
  inicial?: CitaInicial;
}

export function AgendaPage() {
  const { sesion } = useAuth();
  const esEscritorio = useEsEscritorio();
  const enLinea = useEnLinea();
  const hoy = useMemo(hoyLocal, []);

  const [vistaElegida, setVistaElegida] = useState<Vista>("dia");
  const [dia, setDia] = useState(hoy);
  const [profesionalElegido, setProfesionalElegido] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EstadoSheet | null>(null);

  // La semana existe solo en escritorio; en móvil todo es el día.
  const vista: Vista = esEscritorio ? vistaElegida : "dia";

  const { profesionales, error: errorProfesionales } = useProfesionalesDelCentro(sesion?.centroId);
  const rango = vista === "dia" ? rangoDelDia(dia) : rangoDeLaSemana(dia);
  const { citas, error: errorCitas } = useCitasDelRango(sesion?.centroId, rango.inicio, rango.fin);

  // La semana muestra un solo profesional: si no hay ninguno elegido, el propio o el primero.
  const profesionalSemana =
    profesionalElegido ??
    profesionales?.find((p) => p.uid === sesion?.uid)?.uid ??
    profesionales?.[0]?.uid ??
    null;

  const visibles = useMemo(() => {
    if (!citas) return null;
    const filtro = vista === "semana" ? profesionalSemana : profesionalElegido;
    return filtro ? citas.filter((c) => c.profesionalUid === filtro) : citas;
  }, [citas, vista, profesionalSemana, profesionalElegido]);

  const columnas = useMemo(() => {
    if (!profesionales) return [];
    return profesionalElegido ? profesionales.filter((p) => p.uid === profesionalElegido) : profesionales;
  }, [profesionales, profesionalElegido]);

  const paso = vista === "dia" ? 1 : 7;
  const irA = (nuevo: string) => {
    if (fechaIsoSchema.safeParse(nuevo).success) setDia(nuevo);
  };

  const abrirNueva = (inicial?: Partial<CitaInicial>) =>
    setSheet({
      cita: null,
      inicial: {
        fecha: inicial?.fecha ?? dia,
        hora: inicial?.hora,
        profesionalUid: inicial?.profesionalUid ?? (vista === "semana" ? (profesionalSemana ?? undefined) : (profesionalElegido ?? undefined)),
      },
    });

  const cargando = !profesionales || !visibles;
  const error = errorProfesionales ?? errorCitas;
  const activas = visibles?.filter((c) => ocupaFranja(c.estado)).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Agenda del centro"
        title="Agenda"
        description="Las citas se comparten entre todos los profesionales de tu centro."
        actions={
          <Button onClick={() => abrirNueva()} disabled={!enLinea || !profesionales || profesionales.length === 0}>
            <CalendarPlus aria-hidden className="h-4 w-4" />
            Nueva cita
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            aria-label={vista === "dia" ? "Día anterior" : "Semana anterior"}
            onClick={() => irA(sumarDias(dia, -paso))}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            aria-label="Fecha"
            value={dia}
            onChange={(e) => irA(e.target.value)}
            className="w-auto"
          />
          <Button
            variant="secondary"
            size="sm"
            aria-label={vista === "dia" ? "Día siguiente" : "Semana siguiente"}
            onClick={() => irA(sumarDias(dia, paso))}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => irA(hoy)} disabled={dia === hoy && vista === "dia"}>
            Hoy
          </Button>
        </div>

        {esEscritorio && (
          <div role="group" aria-label="Vista de la agenda" className="flex overflow-hidden rounded-md border border-line">
            {(["dia", "semana"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vistaElegida === v}
                onClick={() => setVistaElegida(v)}
                className={cn(
                  "min-h-9 px-3 text-13 font-medium transition-colors",
                  vistaElegida === v ? "bg-accent-wash text-accent" : "bg-surface text-ink hover:bg-accent-wash",
                )}
              >
                {v === "dia" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
        )}
      </div>

      {profesionales && profesionales.length > 1 && (
        <SelectorProfesional
          profesionales={profesionales}
          valor={vista === "semana" ? profesionalSemana : profesionalElegido}
          onChange={setProfesionalElegido}
          permiteTodos={vista === "dia"}
        />
      )}

      <p className="text-sm text-ink-soft" aria-live="polite">
        {vista === "dia" ? (
          <span className="first-letter:uppercase">{etiquetaDiaLarga(dia)}</span>
        ) : (
          <>Semana del {etiquetaDiaLarga(rango.inicio.slice(0, 10))}</>
        )}
        {!cargando && <> · {activas === 1 ? "1 cita" : `${activas} citas`}</>}
      </p>

      {error ? (
        <EmptyState title="No se pudo cargar la agenda" description={error} />
      ) : cargando ? (
        <div className="space-y-2" role="status" aria-label="Cargando agenda">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : profesionales.length === 0 ? (
        // Los admin no se agendan a sí mismos: un centro sin profesionales activos
        // no tiene agenda posible, y quien puede resolverlo es justamente el admin.
        sesion?.rol === "admin" ? (
          <EmptyState
            title="No hay profesionales activos"
            description="Creá un usuario con rol Profesional para empezar a agendar."
            action={
              <Link to="/admin" className={estiloBoton()}>
                Ir a Administración
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No hay profesionales activos"
            description="Pide a un administrador del centro que active al menos un usuario."
          />
        )
      ) : vista === "semana" ? (
        <VistaSemana
          dia={dia}
          hoy={hoy}
          citas={visibles}
          onNueva={(d) => abrirNueva({ fecha: d })}
          onAbrir={(cita) => setSheet({ cita })}
          onIrADia={(d) => {
            setDia(d);
            setVistaElegida("dia");
          }}
        />
      ) : esEscritorio ? (
        <VistaDia
          dia={dia}
          citas={visibles}
          profesionales={columnas}
          onNueva={(hora, profesionalUid) => abrirNueva({ hora, profesionalUid })}
          onAbrir={(cita) => setSheet({ cita })}
        />
      ) : (
        <ListaDia
          dia={dia}
          citas={visibles}
          mostrarProfesional={profesionalElegido === null}
          onNueva={() => abrirNueva()}
          onAbrir={(cita) => setSheet({ cita })}
        />
      )}

      <CitaSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        cita={sheet?.cita ?? null}
        inicial={sheet?.inicial}
        profesionales={profesionales ?? []}
      />
    </div>
  );
}
