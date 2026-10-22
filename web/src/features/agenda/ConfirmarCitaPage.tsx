import { fechaLargaDe, horaDe, type CitaPublicaDatos } from "@cident/shared";
import { CalendarCheck, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, ConfirmarDialog, Spinner } from "../../components/ui";
import { aplicarActualizacion, useHayActualizacion } from "../../lib/actualizacionApp";
import { responderCita, verCitaPublica } from "./agendaApi";

type Resultado = "confirmada" | "cancelada" | null;

/** Página pública (`/c/:token`): el paciente confirma o cancela su cita desde WhatsApp, sin sesión. */
export function ConfirmarCitaPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<CitaPublicaDatos | null>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "invalido">("cargando");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  // Página de solo respuesta: se actualiza sin preguntar, como el portal.
  const hayActualizacion = useHayActualizacion();
  useEffect(() => {
    if (hayActualizacion) aplicarActualizacion();
  }, [hayActualizacion]);

  useEffect(() => {
    let vivo = true;
    verCitaPublica({ token })
      .then(({ data }) => {
        if (!vivo) return;
        setDatos(data);
        setEstado("ok");
      })
      .catch(() => vivo && setEstado("invalido"));
    return () => {
      vivo = false;
    };
  }, [token]);

  async function responder(respuesta: "confirmar" | "cancelar") {
    setEnviando(true);
    setError(null);
    try {
      await responderCita({ token, respuesta });
      setResultado(respuesta === "confirmar" ? "confirmada" : "cancelada");
    } catch {
      setError("No se pudo registrar tu respuesta. Revisa tu conexión o llama al centro.");
    } finally {
      setEnviando(false);
      setConfirmandoCancelar(false);
    }
  }

  if (estado === "cargando") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Spinner label="Cargando tu cita…" />
      </div>
    );
  }

  if (estado === "invalido" || !datos) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Enlace no válido o vencido</h1>
        <p className="text-sm text-ink-soft">Comunícate con tu centro odontológico para gestionar tu cita.</p>
      </div>
    );
  }

  const { centro } = datos;
  const estadoVisible: Resultado | "cancelada-previa" | "cerrada" = resultado
    ? resultado
    : datos.puedeResponder
      ? null
      : datos.estado === "cancelada"
        ? "cancelada-previa"
        : "cerrada";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3">
        {centro.logoDataUrl && <img src={centro.logoDataUrl} alt="" className="h-12 w-12 rounded-md object-contain" />}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{centro.nombre}</p>
          {centro.direccion && <p className="truncate text-13 text-ink-soft">{centro.direccion}</p>}
        </div>
      </header>

      <section className="space-y-1 rounded-lg border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-13 text-ink-soft">
          <CalendarCheck aria-hidden className="h-4 w-4" /> Tu cita
        </p>
        <h1 className="text-xl font-semibold first-letter:uppercase">{fechaLargaDe(datos.inicio)}</h1>
        <p className="text-lg">{horaDe(datos.inicio)}</p>
        <p className="text-sm text-ink-soft">Con {datos.profesionalNombre}</p>
      </section>

      {estadoVisible === "confirmada" && (
        <p role="status" className="rounded-lg bg-accent-wash p-4 text-center font-medium">
          ¡Gracias! Tu asistencia quedó confirmada. Te esperamos.
        </p>
      )}
      {estadoVisible === "cancelada" && (
        <p role="status" className="rounded-lg bg-accent-wash p-4 text-center font-medium">
          Tu cita quedó cancelada. Llámanos cuando quieras reagendar.
        </p>
      )}
      {estadoVisible === "cancelada-previa" && (
        <p role="status" className="rounded-lg bg-accent-wash p-4 text-center">
          Esta cita está cancelada. Llámanos para reagendar.
        </p>
      )}
      {estadoVisible === "cerrada" && (
        <p role="status" className="rounded-lg bg-accent-wash p-4 text-center">
          Esta cita ya no se puede modificar desde el enlace.
        </p>
      )}

      {estadoVisible === null && (
        <div className="flex flex-col gap-3">
          {datos.estado === "confirmada" && (
            <p className="text-center text-sm text-ink-soft">Ya habías confirmado esta cita. Puedes cambiar tu respuesta.</p>
          )}
          <Button className="min-h-touch w-full" onClick={() => void responder("confirmar")} disabled={enviando}>
            Confirmar asistencia
          </Button>
          <Button
            variant="secondary"
           
            className="min-h-touch w-full"
            onClick={() => setConfirmandoCancelar(true)}
            disabled={enviando}
          >
            No podré asistir
          </Button>
          {error && (
            <p role="alert" className="text-center text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {centro.telefono && (
        <a
          href={`tel:${centro.telefono.replace(/[^\d+]/g, "")}`}
          className="inline-flex min-h-touch items-center justify-center gap-2 rounded-md border border-input bg-surface px-4 text-sm font-medium hover:bg-accent-wash"
        >
          <Phone aria-hidden className="h-4 w-4" /> Llamar al centro
        </a>
      )}

      <footer className="mt-auto pt-4 text-center text-13 text-ink-soft">Luna-Dental</footer>

      <ConfirmarDialog
        open={confirmandoCancelar}
        onCancel={() => setConfirmandoCancelar(false)}
        onConfirm={() => void responder("cancelar")}
        title="¿Cancelar tu cita?"
        description="El centro liberará el horario. Podrás reagendar llamando al centro."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        variant="danger"
        loading={enviando}
      />
    </div>
  );
}
