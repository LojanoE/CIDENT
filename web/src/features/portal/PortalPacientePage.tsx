import type { PortalPacienteDatos, Zona } from "@cident/shared";
import { Phone } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Spinner } from "../../components/ui";
import { aplicarActualizacion, useHayActualizacion } from "../../lib/actualizacionApp";
import { soportaWebGL } from "../../lib/webgl";
import { LeyendaOdontograma } from "../odontograma/LeyendaOdontograma";
import { ErrorBoundary3D } from "../odontograma/3d/ErrorBoundary3D";
import type { SeleccionOdontograma } from "../odontograma/Odontograma";
import { verPortalPaciente } from "./portalApi";

const Odontograma3D = lazy(() =>
  import("../odontograma/3d/Odontograma3D").then((m) => ({ default: m.Odontograma3D })),
);

const WEBGL = soportaWebGL();

const NOMBRE_ZONA: Record<Zona, string> = {
  oclusal: "Masticatoria",
  vestibular: "Externa",
  lingual: "Interna",
  mesial: "Lateral (hacia el frente)",
  distal: "Lateral (hacia el fondo)",
};

function fechaLarga(inicio: string): string {
  const [dia, hora] = inicio.split("T");
  const f = new Date(`${dia}T00:00:00`);
  const texto = f.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}, ${hora}`;
}

function DetalleDiente({ datos, fdi }: { datos: PortalPacienteDatos; fdi: number }) {
  const diente = datos.odontograma?.dientes[String(fdi)];
  const lineas: string[] = [];
  if (diente?.general?.estados.length) lineas.push(`Diente completo: ${diente.general.estados.join(", ")}`);
  for (const [zona, valor] of Object.entries(diente?.zonas ?? {})) {
    if (valor?.estados.length) lineas.push(`${NOMBRE_ZONA[zona as Zona]}: ${valor.estados.join(", ")}`);
  }
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-semibold">Pieza {fdi}</p>
      {lineas.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin hallazgos registrados.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {lineas.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Portal público del paciente (`/p/:token`): solo lectura, sin sesión, sin dinero. */
export function PortalPacientePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<PortalPacienteDatos | null>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "invalido">("cargando");
  const [seleccion, setSeleccion] = useState<SeleccionOdontograma | null>(null);

  // El portal es de solo lectura: se actualiza sin preguntar.
  const hayActualizacion = useHayActualizacion();
  useEffect(() => {
    if (hayActualizacion) aplicarActualizacion();
  }, [hayActualizacion]);

  useEffect(() => {
    let vivo = true;
    verPortalPaciente({ token })
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

  if (estado === "cargando") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Spinner label="Cargando tu información…" />
      </div>
    );
  }

  if (estado === "invalido" || !datos) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Enlace no válido o vencido</h1>
        <p className="text-sm text-ink-soft">
          Pide a tu centro odontológico que te envíe un enlace nuevo.
        </p>
      </div>
    );
  }

  const { centro, paciente, odontograma, plan, citas } = datos;

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 px-4 py-6">
      <header className="flex items-center gap-3">
        {centro.logoDataUrl && (
          <img src={centro.logoDataUrl} alt="" className="h-12 w-12 rounded-md object-contain" />
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{centro.nombre}</p>
          {centro.direccion && <p className="truncate text-13 text-ink-soft">{centro.direccion}</p>}
        </div>
      </header>

      <h1 className="text-xl font-semibold">Hola{paciente.nombre ? `, ${paciente.nombre}` : ""} 👋</h1>

      <section aria-labelledby="t-boca" className="space-y-3">
        <h2 id="t-boca" className="text-base font-semibold">
          Tu boca en 3D
        </h2>
        {!odontograma ? (
          <p className="text-sm text-ink-soft">Aún no hay un odontograma registrado.</p>
        ) : WEBGL ? (
          <>
            <ErrorBoundary3D
              alternativa={<p className="text-sm text-ink-soft">No se pudo cargar la vista 3D.</p>}
            >
              <Suspense fallback={<Spinner label="Cargando vista 3D…" />}>
                <Odontograma3D
                  tipo={odontograma.tipo}
                  dientes={odontograma.dientes}
                  soloLectura
                  seleccion={seleccion}
                  onZonaClick={(fdi, zona) => setSeleccion({ fdi, zona })}
                  onGeneralClick={(fdi) => setSeleccion({ fdi, zona: null })}
                />
              </Suspense>
            </ErrorBoundary3D>
            {seleccion && <DetalleDiente datos={datos} fdi={seleccion.fdi} />}
            <LeyendaOdontograma />
          </>
        ) : (
          <p className="text-sm text-ink-soft">Tu navegador no admite gráficos 3D.</p>
        )}
      </section>

      <section aria-labelledby="t-plan" className="space-y-2">
        <h2 id="t-plan" className="text-base font-semibold">
          Tu plan de tratamiento
        </h2>
        {!plan ? (
          <p className="text-sm text-ink-soft">Por ahora no tienes un plan pendiente.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {plan.tratamientos.map((t, i) => (
              <li key={`${t.tratamiento}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">{t.tratamiento}</span>
                <span className="shrink-0 text-ink-soft">
                  {t.pieza ? `Pieza ${t.pieza}` : ""}
                  {t.cantidad > 1 ? ` ×${t.cantidad}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-citas" className="space-y-2">
        <h2 id="t-citas" className="text-base font-semibold">
          Tus próximas citas
        </h2>
        {citas.length === 0 ? (
          <p className="text-sm text-ink-soft">No tienes citas programadas.</p>
        ) : (
          <ul className="space-y-2">
            {citas.map((c) => (
              <li key={c.inicio} className="rounded-lg border border-line bg-surface p-3 text-sm">
                <p className="font-medium">{fechaLarga(c.inicio)}</p>
                <p className="text-ink-soft">
                  {c.profesionalNombre}
                  {c.motivo ? ` · ${c.motivo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        {centro.telefono && (
          <a
            href={`tel:${centro.telefono.replace(/[^\d+]/g, "")}`}
            className="inline-flex min-h-touch items-center gap-2 rounded-md border border-input bg-surface px-4 text-sm font-medium hover:bg-accent-wash"
          >
            <Phone aria-hidden className="h-4 w-4" /> Llamar al centro
          </a>
        )}
      </section>

      <footer className="pt-4 text-center text-13 text-ink-soft">Luna-Dental</footer>
    </div>
  );
}
