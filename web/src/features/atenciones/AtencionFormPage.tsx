import { atencionSchema, type Atencion, type AtencionInput } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Lock } from "lucide-react";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { StickyActions } from "../../components/layout";
import {
  Button,
  Card,
  CardBody,
  ConfirmarDialog,
  Field,
  Input,
  NumberStepper,
  Textarea,
  useToast,
} from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { vincularCitaAAtencion } from "../agenda/agendaApi";
import { useGuardaCambios } from "../../lib/useGuardaCambios";
import { actualizarAtencion, crearAtencion, obtenerAtencion } from "./atencionesApi";
import { AtencionContext } from "./useAtencion";

/** Fecha de hoy en hora local: `toISOString()` daría el día siguiente por la tarde-noche en Ecuador. */
function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

const valoresPorDefecto = (): AtencionInput => ({
  fecha: hoyLocal(),
  motivo: "",
  problemaActual: "",
  antecedentes: "",
  signosVitales: "",
  examenEstomatognatico: "",
  indicadores: { placa: 0, calculo: 0, gingivitis: 0 },
  cpo: { c: 0, p: 0, o: 0 },
  notas: "",
});

function desdeAtencion(a: Atencion): AtencionInput {
  return {
    fecha: a.fecha,
    motivo: a.motivo,
    problemaActual: a.problemaActual,
    antecedentes: a.antecedentes,
    signosVitales: a.signosVitales,
    examenEstomatognatico: a.examenEstomatognatico,
    indicadores: a.indicadores,
    cpo: { c: a.cpo.c, p: a.cpo.p, o: a.cpo.o },
    notas: a.notas,
  };
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-base font-semibold">{titulo}</h3>
        {children}
      </CardBody>
    </Card>
  );
}

/** Bloque de etiqueta + stepper. No usa `Field`: su `<label>` envolvente rompería el grupo del stepper. */
function Medida({ etiqueta, error, children }: { etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{etiqueta}</p>
      {children}
      {error && (
        <p role="alert" className="text-13 font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Ficha de la atención. Dos modos: «nueva» (ruta `atenciones/nueva`, sin layout) y «edición»
 * (índice de `AtencionLayout`, que aporta la atención cargada por contexto).
 */
export function AtencionFormPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { sesion } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const citaId = searchParams.get("citaId");
  const toast = useToast();
  const ctx = useContext(AtencionContext);
  const existente = ctx?.atencion ?? null;

  const esFinal = existente?.estado === "final";
  const soloLectura = esFinal && sesion?.rol !== "admin";

  const [guardando, setGuardando] = useState<"draft" | "final" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const pendienteFinal = useRef<AtencionInput | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<AtencionInput>({
    resolver: zodResolver(atencionSchema),
    defaultValues: existente ? desdeAtencion(existente) : valoresPorDefecto(),
  });

  useEffect(() => {
    if (existente) reset(desdeAtencion(existente));
  }, [existente, reset]);

  const { blocker, permitirSalida } = useGuardaCambios(isDirty && !soloLectura);

  const cpo = useWatch({ control, name: "cpo" });
  const totalCpo = (Number(cpo?.c) || 0) + (Number(cpo?.p) || 0) + (Number(cpo?.o) || 0);

  const guardar = async (values: AtencionInput, estado: "draft" | "final") => {
    if (!patientId || !sesion) return;
    setGuardando(estado);
    try {
      if (!existente) {
        const nuevoId = await crearAtencion(patientId, sesion.centroId, sesion.uid, values, estado);
        if (citaId) {
          try {
            await vincularCitaAAtencion(citaId, nuevoId, sesion.uid);
          } catch {
            // La atención ya se guardó; el vínculo con la cita no debe tumbar el flujo clínico.
            toast.info("La atención se guardó, pero no se pudo marcar la cita como atendida.");
          }
        }
        permitirSalida();
        toast.ok(estado === "final" ? "Atención finalizada." : "Borrador guardado.");
        navigate(`/pacientes/${patientId}/atenciones/${nuevoId}`, { replace: true });
      } else {
        await actualizarAtencion(patientId, existente.visitId, values, estado, sesion.uid, esFinal);
        const actualizada = await obtenerAtencion(patientId, existente.visitId);
        if (actualizada) ctx?.alActualizar(actualizada);
        toast.ok(estado === "final" ? "Atención finalizada." : "Borrador guardado.");
      }
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(null);
      setConfirmando(false);
    }
  };

  const pedirConfirmacion = handleSubmit((values) => {
    pendienteFinal.current = values;
    setConfirmando(true);
  });

  return (
    <div className="max-w-3xl space-y-4">
      {!existente && <h2 className="text-xl font-semibold">Nueva atención</h2>}

      {soloLectura && (
        <p className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-ink-soft">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Esta atención está finalizada y no se puede modificar.
        </p>
      )}
      {esFinal && !soloLectura && (
        <p className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Esta atención está finalizada. Como administrador puedes corregirla; los cambios quedan auditados.
        </p>
      )}

      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset disabled={soloLectura} className="min-w-0 space-y-4 disabled:opacity-80">
          <Seccion titulo="Datos generales">
            <Field label="Fecha" error={errors.fecha?.message} className="sm:max-w-xs">
              <Input type="date" {...register("fecha")} />
            </Field>
          </Seccion>

          <Seccion titulo="Anamnesis y examen">
            <Field label="1. Motivo de consulta" error={errors.motivo?.message}>
              <Textarea rows={2} {...register("motivo")} />
            </Field>
            <Field label="2. Problema actual" error={errors.problemaActual?.message}>
              <Textarea rows={3} {...register("problemaActual")} />
            </Field>
            <Field label="3. Antecedentes" error={errors.antecedentes?.message}>
              <Textarea rows={3} {...register("antecedentes")} />
            </Field>
            <Field label="4. Signos vitales" error={errors.signosVitales?.message}>
              <Input {...register("signosVitales")} />
            </Field>
            <Field label="5. Examen estomatognático" error={errors.examenEstomatognatico?.message}>
              <Textarea rows={3} {...register("examenEstomatognatico")} />
            </Field>
          </Seccion>

          <Seccion titulo="Indicadores de higiene">
            <div className="grid gap-4 sm:grid-cols-3">
              <Medida etiqueta="Placa (0-3)" error={errors.indicadores?.placa?.message}>
                <Controller
                  control={control}
                  name="indicadores.placa"
                  render={({ field }) => (
                    <NumberStepper label="Placa" min={0} max={3} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
              <Medida etiqueta="Cálculo (0-3)" error={errors.indicadores?.calculo?.message}>
                <Controller
                  control={control}
                  name="indicadores.calculo"
                  render={({ field }) => (
                    <NumberStepper label="Cálculo" min={0} max={3} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
              <Medida etiqueta="Gingivitis (0-1)" error={errors.indicadores?.gingivitis?.message}>
                <Controller
                  control={control}
                  name="indicadores.gingivitis"
                  render={({ field }) => (
                    <NumberStepper label="Gingivitis" min={0} max={1} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
            </div>
          </Seccion>

          <Seccion titulo="Índice CPO-CEO">
            <div className="grid gap-4 sm:grid-cols-4">
              <Medida etiqueta="C (cariados)" error={errors.cpo?.c?.message}>
                <Controller
                  control={control}
                  name="cpo.c"
                  render={({ field }) => (
                    <NumberStepper label="Cariados" min={0} max={32} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
              <Medida etiqueta="P (perdidos)" error={errors.cpo?.p?.message}>
                <Controller
                  control={control}
                  name="cpo.p"
                  render={({ field }) => (
                    <NumberStepper label="Perdidos" min={0} max={32} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
              <Medida etiqueta="O (obturados)" error={errors.cpo?.o?.message}>
                <Controller
                  control={control}
                  name="cpo.o"
                  render={({ field }) => (
                    <NumberStepper label="Obturados" min={0} max={32} value={field.value} onChange={field.onChange} disabled={soloLectura} />
                  )}
                />
              </Medida>
              <Medida etiqueta="Total">
                <p
                  aria-label="Total CPO"
                  className="flex min-h-touch items-center font-mono text-lg font-medium tabular-nums"
                >
                  {totalCpo}
                </p>
              </Medida>
            </div>
          </Seccion>

          <Seccion titulo="Notas">
            <Field label="Notas / observaciones" error={errors.notas?.message}>
              <Textarea rows={3} {...register("notas")} />
            </Field>
          </Seccion>
        </fieldset>

        {!soloLectura && (
          <StickyActions>
            {isDirty && <span className="mr-auto text-13 text-ink-soft">Hay cambios sin guardar</span>}
            <Button
              type="button"
              variant="secondary"
              loading={guardando === "draft"}
              disabled={guardando !== null}
              onClick={handleSubmit((v) => guardar(v, "draft"))}
            >
              Guardar borrador
            </Button>
            <Button type="button" disabled={guardando !== null} onClick={pedirConfirmacion}>
              Finalizar atención
            </Button>
          </StickyActions>
        )}
      </form>

      <ConfirmarDialog
        open={confirmando}
        title="¿Finalizar esta atención?"
        description="Una vez finalizada, la atención queda bloqueada y solo un administrador podrá corregirla. Revisa los datos antes de continuar."
        confirmLabel="Sí, finalizar"
        loading={guardando === "final"}
        onCancel={() => setConfirmando(false)}
        onConfirm={() => pendienteFinal.current && guardar(pendienteFinal.current, "final")}
      />

      <ConfirmarDialog
        open={blocker.state === "blocked"}
        title="Hay cambios sin guardar"
        description="Si sales ahora perderás lo que escribiste en esta atención. ¿Deseas salir de todos modos?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        variant="danger"
        onCancel={() => blocker.state === "blocked" && blocker.reset()}
        onConfirm={() => blocker.state === "blocked" && blocker.proceed()}
      />
    </div>
  );
}
