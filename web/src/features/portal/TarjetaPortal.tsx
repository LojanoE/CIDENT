import type { EnlacePortal, Paciente } from "@cident/shared";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Copy, MessageCircle, QrCode, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { Button, Card, CardBody, CardHeader, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { crearEnlacePortal, revocarEnlacePortal, urlPortal } from "./portalApi";

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Solo dígitos; sin prefijo de país no se puede armar un wa.me confiable, así que se omite el número. */
function enlaceWhatsApp(telefono: string, url: string, nombre: string): string {
  const texto = encodeURIComponent(`Hola ${nombre}, aquí puedes ver tu boca en 3D y tu plan de tratamiento: ${url}`);
  const digitos = telefono.replace(/\D/g, "");
  let numero = "";
  if (digitos.startsWith("593")) numero = digitos;
  else if (digitos.startsWith("09") && digitos.length === 10) numero = `593${digitos.slice(1)}`;
  return `https://wa.me/${numero}?text=${texto}`;
}

/** Tarjeta «Portal del paciente»: genera, comparte y revoca el enlace público de solo lectura. */
export function TarjetaPortal({ paciente }: { paciente: Paciente }) {
  const { sesion } = useAuth();
  const toast = useToast();
  const [activo, setActivo] = useState<EnlacePortal | null>(null);
  const [nuevo, setNuevo] = useState<{ url: string; qr: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const centroId = sesion?.centroId;
  const patientId = paciente.patientId;

  useEffect(() => {
    if (!centroId) return;
    const q = query(
      collection(db, "portalLinks"),
      where("centroId", "==", centroId),
      where("patientId", "==", patientId),
      where("revocado", "==", false),
    );
    return onSnapshot(
      q,
      (snap) => {
        const vigentes = snap.docs
          .map((d) => d.data() as EnlacePortal)
          .filter((e) => new Date(e.expiraAt).getTime() > Date.now())
          .sort((a, b) => b.creadoAt.localeCompare(a.creadoAt));
        setActivo(vigentes[0] ?? null);
        if (vigentes.length === 0) setNuevo(null);
      },
      () => setActivo(null),
    );
  }, [centroId, patientId]);

  async function generar() {
    setTrabajando(true);
    try {
      const { data } = await crearEnlacePortal({ patientId });
      const url = urlPortal(data.token);
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
      setNuevo({ url, qr });
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function revocar() {
    setTrabajando(true);
    try {
      await revocarEnlacePortal({ patientId });
      setNuevo(null);
      toast.ok("Enlace revocado.");
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar() {
    if (!nuevo) return;
    try {
      await navigator.clipboard.writeText(nuevo.url);
      toast.ok("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Portal del paciente" />
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-soft">
          El paciente ve su boca en 3D, su plan de tratamiento (sin precios) y sus próximas citas desde el
          celular, sin cuenta. El enlace dura 30 días y se puede revocar cuando quieras.
        </p>

        {activo && (
          <p className="text-sm">
            <span className="font-medium">Enlace activo</span> hasta el {fechaCorta(activo.expiraAt)}.
            {!nuevo && " Por seguridad el enlace solo se muestra al generarlo; genera uno nuevo para compartirlo."}
          </p>
        )}

        {nuevo && (
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img src={nuevo.qr} alt="Código QR del portal del paciente" className="h-40 w-40 rounded-md border border-line bg-white" />
            <div className="min-w-0 space-y-2">
              <p className="break-all rounded-md border border-line bg-surface p-2 font-mono text-13">{nuevo.url}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={copiar}>
                  <Copy aria-hidden className="h-4 w-4" /> Copiar enlace
                </Button>
                <a
                  href={enlaceWhatsApp(paciente.telefono, nuevo.url, paciente.nombres.split(/\s+/)[0] ?? "")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-touch select-none items-center justify-center gap-2 rounded-md border border-input bg-surface px-3 text-13 font-medium text-ink hover:bg-accent-wash md:min-h-9"
                >
                  <MessageCircle aria-hidden className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={generar} loading={trabajando}>
            <QrCode aria-hidden className="h-4 w-4" /> {activo ? "Generar enlace nuevo" : "Generar enlace"}
          </Button>
          {activo && (
            <Button variant="danger" onClick={revocar} disabled={trabajando}>
              <Trash2 aria-hidden className="h-4 w-4" /> Revocar
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
