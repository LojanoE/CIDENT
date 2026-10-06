import {
  armarRecordatorio,
  DURACIONES_MIN,
  ESTADOS_CITA,
  citaSchema,
  citasEnConflicto,
  diaDe,
  duracionMinutos,
  fechaIsoSchema,
  horaDe,
  rangoDelDia,
  sumarMinutos,
  type Cita,
  type CitaInput,
  type Paciente,
  type Usuario,
} from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { AlertTriangle, MessageCircle, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z, ZodError } from "zod";
import { useAuth } from "../../app/AuthProvider";
import {
  Button,
  ConfirmarDialog,
  Field,
  Input,
  SearchInput,
  Select,
  Sheet,
  Textarea,
  estiloBoton,
  useToast,
} from "../../components/ui";
import { cn } from "../../lib/cn";
import { mensajeError } from "../../lib/mensajeError";
import { useEnLinea } from "../../lib/useEnLinea";
import { enlaceWhatsApp } from "../../lib/whatsapp";
import { useCentroActual } from "../centros/centrosApi";
import { pacientesCollection } from "../pacientes/pacientesApi";
import { actualizarCita, cancelarCita, crearCita, marcarRecordatorioEnviado } from "./agendaApi";
import { ETIQUETA_ESTADO } from "./estados";
import { useCitasDelRango } from "./useAgenda";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validación de los campos tal como los entrega el DOM; `citaSchema` valida el resultado final. */
const esquema = z.object({
  pacienteNombre: z.string().trim().min(1, "El nombre del paciente es obligatorio").max(240, "El nombre es demasiado largo"),
  pacienteTelefono: z.string().trim().max(30, "El teléfono es demasiado largo"),
  profesionalUid: z.string().min(1, "Hay que elegir un profesional"),
  fecha: fechaIsoSchema,
  horaInicio: z.string().regex(HORA, "Indica una hora válida (HH:MM)"),
  duracion: z.string().min(1),
  motivo: z.string().trim().max(500, "El motivo es demasiado largo"),
  estado: z.enum(ESTADOS_CITA),
  notas: z.string().trim().max(2000, "Las notas son demasiado largas"),
});
type ValoresCita = z.infer<typeof esquema>;

export interface CitaInicial {
  fecha: string;
  hora?: string;
  profesionalUid?: string;
}

interface CitaSheetProps {
  open: boolean;
  onClose: () => void;
  /** Cita a editar; `null` para agendar una nueva. */
  cita: Cita | null;
  /** Valores sugeridos al agendar (p. ej. la franja donde se hizo clic). */
  inicial?: CitaInicial;
  profesionales: Usuario[];
}

export function CitaSheet(props: CitaSheetProps) {
  // Se monta solo abierta: cada apertura arranca con un formulario limpio.
  return props.open ? <FormularioCita {...props} /> : null;
}

function duracionInicial(cita: Cita | null): string {
  if (!cita) return "30";
  const min = duracionMinutos(cita);
  return String(min);
}

function FormularioCita({ onClose, cita, inicial, profesionales }: CitaSheetProps) {
  const { sesion } = useAuth();
  const enLinea = useEnLinea();
  const toast = useToast();
  const editando = cita !== null;
  const centroActual = useCentroActual(sesion?.centroId);

  const [patientId, setPatientId] = useState<string | null>(cita?.patientId ?? null);
  const [modoFicha, setModoFicha] = useState(Boolean(cita?.patientId));
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const profesionalPorDefecto =
    cita?.profesionalUid ??
    inicial?.profesionalUid ??
    profesionales.find((p) => p.uid === sesion?.uid)?.uid ??
    profesionales[0]?.uid ??
    "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ValoresCita>({
    resolver: zodResolver(esquema),
    defaultValues: {
      pacienteNombre: cita?.pacienteNombre ?? "",
      pacienteTelefono: cita?.pacienteTelefono ?? "",
      profesionalUid: profesionalPorDefecto,
      fecha: cita ? diaDe(cita.inicio) : (inicial?.fecha ?? ""),
      horaInicio: cita ? horaDe(cita.inicio) : (inicial?.hora ?? "09:00"),
      duracion: duracionInicial(cita),
      motivo: cita?.motivo ?? "",
      estado: cita?.estado ?? "pendiente",
      notas: cita?.notas ?? "",
    },
  });

  const [fecha, horaInicio, duracion, profesionalUid, estado] = watch([
    "fecha",
    "horaInicio",
    "duracion",
    "profesionalUid",
    "estado",
  ]);

  // ---- Advertencia de solapamiento (no bloquea) ----
  const fechaValida = fechaIsoSchema.safeParse(fecha).success;
  const rango = fechaValida ? rangoDelDia(fecha) : { inicio: "", fin: "" };
  const { citas: citasDelDia } = useCitasDelRango(fechaValida ? sesion?.centroId : undefined, rango.inicio, rango.fin);

  const conflictos = useMemo(() => {
    if (!citasDelDia || !fechaValida || !HORA.test(horaInicio) || !profesionalUid) return [];
    const minutos = Number(duracion);
    if (!Number.isFinite(minutos) || minutos <= 0) return [];
    const inicio = `${fecha}T${horaInicio}`;
    return citasEnConflicto(
      { appointmentId: cita?.appointmentId, profesionalUid, inicio, fin: sumarMinutos(inicio, minutos), estado },
      citasDelDia,
    );
  }, [citasDelDia, fechaValida, fecha, horaInicio, duracion, profesionalUid, estado, cita?.appointmentId]);

  // ---- Búsqueda de pacientes con ficha ----
  const [pacientes, setPacientes] = useState<Paciente[] | null>(null);
  const [filtro, setFiltro] = useState("");
  const buscando = modoFicha && patientId === null;

  useEffect(() => {
    if (!buscando || !sesion) return;
    const q = query(pacientesCollection(), where("centroId", "==", sesion.centroId), orderBy("apellidosLower"));
    return onSnapshot(
      q,
      (snap) => setPacientes(snap.docs.map((d) => d.data() as Paciente)),
      (err) => toast.error(mensajeError(err)),
    );
  }, [buscando, sesion, toast]);

  const coincidencias = useMemo(() => {
    const texto = filtro.trim().toLowerCase();
    if (!pacientes || !texto) return [];
    return pacientes
      .filter((p) => p.apellidosLower.includes(texto) || p.nombresLower.includes(texto) || p.cedula.includes(texto))
      .slice(0, 6);
  }, [pacientes, filtro]);

  function elegirPaciente(p: Paciente) {
    setPatientId(p.patientId);
    setValue("pacienteNombre", `${p.apellidos} ${p.nombres}`, { shouldValidate: true });
    setValue("pacienteTelefono", p.telefono ?? "");
  }

  function quitarPaciente() {
    setPatientId(null);
    setValue("pacienteNombre", "");
    setValue("pacienteTelefono", "");
    setFiltro("");
  }

  // ---- Guardar ----
  const guardar = handleSubmit(async (v) => {
    if (!sesion) return;
    const inicio = `${v.fecha}T${v.horaInicio}`;
    const fin = sumarMinutos(inicio, Number(v.duracion));

    let input: CitaInput;
    try {
      input = citaSchema.parse({
        patientId,
        pacienteNombre: v.pacienteNombre,
        pacienteTelefono: v.pacienteTelefono,
        profesionalUid: v.profesionalUid,
        inicio,
        fin,
        motivo: v.motivo,
        estado: v.estado,
        notas: v.notas,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        // Lo habitual: una cita que cruzaría la medianoche.
        setError("horaInicio", { message: e.issues[0]?.message ?? "La cita no es válida" });
        return;
      }
      throw e;
    }

    const profesionalNombre = profesionales.find((p) => p.uid === v.profesionalUid)?.nombreCompleto ?? cita?.profesionalNombre ?? "";
    try {
      if (cita) {
        await actualizarCita(cita.appointmentId, input, sesion.uid, profesionalNombre);
        toast.ok("Cita actualizada");
      } else {
        await crearCita(input, sesion.centroId, sesion.uid, profesionalNombre);
        toast.ok("Cita agendada");
      }
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  });

  async function confirmarCancelacion() {
    if (!cita || !sesion) return;
    setCancelando(true);
    try {
      await cancelarCita(cita.appointmentId, "", sesion.uid);
      toast.ok("Cita cancelada");
      setConfirmandoCancelar(false);
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCancelando(false);
    }
  }

  const opcionModo = (activo: boolean) =>
    cn(
      "min-h-touch flex-1 rounded-md border px-3 text-13 font-medium transition-colors md:min-h-9",
      activo ? "border-accent bg-accent-wash text-accent" : "border-line bg-surface text-ink hover:bg-accent-wash",
    );

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={editando ? "Editar cita" : "Nueva cita"}
        description={editando ? cita.pacienteNombre : "Cualquier profesional del centro puede ver y modificar esta cita."}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            {editando && cita.estado !== "cancelada" ? (
              <Button variant="danger" onClick={() => setConfirmandoCancelar(true)}>
                Cancelar cita
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" form="form-cita" loading={isSubmitting} disabled={!enLinea}>
              {editando ? "Guardar cambios" : "Agendar cita"}
            </Button>
          </div>
        }
      >
        {editando && cita.estado !== "cancelada" && (
          <div className="mb-4 flex flex-wrap gap-2">
            {!cita.patientId && (
              <Link to={`/pacientes/nuevo?citaId=${cita.appointmentId}`} className={estiloBoton({ variant: "secondary" })}>
                Crear ficha del paciente
              </Link>
            )}
            {cita.patientId && !cita.visitId && (
              <Link
                to={`/pacientes/${cita.patientId}/atenciones/nueva?citaId=${cita.appointmentId}`}
                className={estiloBoton({ variant: "primary" })}
              >
                Iniciar atención
              </Link>
            )}
            {cita.patientId && cita.visitId && (
              <Link
                to={`/pacientes/${cita.patientId}/atenciones/${cita.visitId}`}
                className={estiloBoton({ variant: "secondary" })}
              >
                Ver atención
              </Link>
            )}
            {(cita.estado === "pendiente" || cita.estado === "confirmada") && cita.pacienteTelefono.trim() && (
              <a
                href={enlaceWhatsApp(
                  cita.pacienteTelefono,
                  armarRecordatorio(centroActual.plantillaRecordatorio, {
                    paciente: cita.pacienteNombre,
                    inicio: cita.inicio,
                    profesional: cita.profesionalNombre,
                    centro: centroActual.nombre ?? "",
                    direccion: centroActual.direccion,
                    telefono: centroActual.telefono,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!enLinea}
                onClick={(e) => {
                  if (!enLinea || !sesion) {
                    e.preventDefault();
                    return;
                  }
                  void marcarRecordatorioEnviado(cita.appointmentId, sesion.uid).catch((err) =>
                    toast.error(mensajeError(err)),
                  );
                }}
                className={cn(estiloBoton({ variant: "secondary" }), !enLinea && "pointer-events-none opacity-50")}
              >
                <MessageCircle aria-hidden className="h-4 w-4" />
                {cita.recordatorioEnviadoAt ? "Recordar de nuevo" : "Recordar por WhatsApp"}
              </a>
            )}
          </div>
        )}

        <form id="form-cita" onSubmit={guardar} noValidate className="space-y-4">
          {/* Paciente: con ficha o sin ella */}
          {!editando && (
            <div role="group" aria-label="Tipo de paciente" className="flex gap-2">
              <button
                type="button"
                aria-pressed={!modoFicha}
                className={opcionModo(!modoFicha)}
                onClick={() => {
                  setModoFicha(false);
                  if (patientId) quitarPaciente();
                }}
              >
                Paciente nuevo
              </button>
              <button type="button" aria-pressed={modoFicha} className={opcionModo(modoFicha)} onClick={() => setModoFicha(true)}>
                Con ficha
              </button>
            </div>
          )}

          {buscando && (
            <div className="space-y-2">
              <SearchInput label="Buscar paciente con ficha" placeholder="Cédula o nombre…" onSearch={setFiltro} />
              {filtro.trim() && pacientes && coincidencias.length === 0 && (
                <p className="text-13 text-ink-soft">Ningún paciente coincide. Agenda como paciente nuevo y crea la ficha después.</p>
              )}
              {coincidencias.length > 0 && (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {coincidencias.map((p) => (
                    <li key={p.patientId}>
                      <button
                        type="button"
                        onClick={() => elegirPaciente(p)}
                        className="block min-h-touch w-full px-3 py-2 text-left hover:bg-accent-wash"
                      >
                        <span className="block text-sm font-medium">
                          {p.apellidos} {p.nombres}
                        </span>
                        <span className="block font-mono text-13 text-ink-soft">{p.cedula}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {modoFicha && patientId && (
            <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm">
              <UserRound aria-hidden className="h-4 w-4 shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1 truncate">Ficha vinculada</span>
              <Link to={`/pacientes/${patientId}`} className="font-medium text-accent underline-offset-2 hover:underline">
                Ver ficha
              </Link>
              {!editando && (
                <button
                  type="button"
                  aria-label="Quitar paciente"
                  onClick={quitarPaciente}
                  className="-m-2 flex min-h-touch min-w-touch items-center justify-center text-ink-soft hover:text-ink"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {(!modoFicha || patientId) && (
            <>
              <Field label="Nombre del paciente" required error={errors.pacienteNombre?.message}>
                <Input autoComplete="off" readOnly={Boolean(patientId)} {...register("pacienteNombre")} />
              </Field>
              <Field label="Teléfono" error={errors.pacienteTelefono?.message}>
                <Input type="tel" autoComplete="off" readOnly={Boolean(patientId)} {...register("pacienteTelefono")} />
              </Field>
            </>
          )}

          <Field label="Profesional" required error={errors.profesionalUid?.message}>
            <Select {...register("profesionalUid")}>
              {profesionales.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.nombreCompleto}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" required error={errors.fecha?.message}>
              <Input type="date" {...register("fecha")} />
            </Field>
            <Field label="Hora de inicio" required error={errors.horaInicio?.message}>
              <Input type="time" step={300} {...register("horaInicio")} />
            </Field>
          </div>

          <Field label="Duración">
            <Select {...register("duracion")}>
              {[...new Set([...DURACIONES_MIN.map(String), duracion])].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>

          {conflictos.length > 0 && (
            <div role="status" className="flex gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Este profesional ya tiene una cita en ese horario.</p>
                <ul className="mt-1 text-13">
                  {conflictos.map((c) => (
                    <li key={c.appointmentId}>
                      <span className="font-mono">
                        {horaDe(c.inicio)}–{horaDe(c.fin)}
                      </span>{" "}
                      · {c.pacienteNombre}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-13">Puedes guardar de todos modos.</p>
              </div>
            </div>
          )}

          <Field label="Motivo" error={errors.motivo?.message}>
            <Input {...register("motivo")} />
          </Field>

          <Field label="Estado">
            <Select {...register("estado")}>
              {ESTADOS_CITA.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notas" error={errors.notas?.message}>
            <Textarea {...register("notas")} />
          </Field>
        </form>
      </Sheet>

      <ConfirmarDialog
        open={confirmandoCancelar}
        onCancel={() => setConfirmandoCancelar(false)}
        onConfirm={confirmarCancelacion}
        title="¿Cancelar esta cita?"
        description="La cita queda registrada como cancelada y libera el horario. Puedes reactivarla cambiando su estado."
        confirmLabel="Cancelar cita"
        cancelLabel="Volver"
        variant="danger"
        loading={cancelando}
      />
    </>
  );
}
