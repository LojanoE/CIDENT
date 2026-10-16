import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "../../components/layout";
import { Badge, Button, Card, CardBody, ConfirmarDialog, Field, Input, Skeleton, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { FirmaCanvas } from "../documentos/FirmaCanvas";
import {
  archivoABase64,
  certificadoVencido,
  diasParaVencer,
  eliminarCertificadoFirma,
  guardarCertificadoFirma,
  guardarFirmaManuscrita,
  obtenerFirmaManuscrita,
  usePerfilFirma,
} from "./firmaApi";

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });

function FirmaElectronicaCard() {
  const toast = useToast();
  const { firmaElectronica: cert, cargado } = usePerfilFirma();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo || !password) return;
    setGuardando(true);
    try {
      const p12Base64 = await archivoABase64(archivo);
      const guardado = await guardarCertificadoFirma({ p12Base64, password });
      toast.ok(`Firma electrónica de ${guardado.titular} guardada.`);
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setPassword(""); // la contraseña nunca se queda en pantalla
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setConfirmarQuitar(false);
    try {
      await eliminarCertificadoFirma();
      toast.ok("Firma electrónica eliminada.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const vencida = certificadoVencido(cert);
  const dias = cert ? diasParaVencer(cert) : 0;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Firma electrónica</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Si tienes un certificado de firma electrónica (archivo .p12), tus documentos saldrán firmados digitalmente.
            Se guarda cifrado; la contraseña se te pedirá al firmar cada documento y nunca se almacena.
          </p>
        </div>

        {!cargado ? (
          <Skeleton className="h-16 w-full" />
        ) : cert ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-medium">{cert.titular}</p>
              <p className="text-ink-soft">Emitido por {cert.emisor}</p>
              <p className="text-ink-soft">Vence el {fechaCorta(cert.validoHasta)}</p>
            </div>
            <div className="flex items-center gap-2">
              {vencida ? (
                <Badge tone="danger">Vencida</Badge>
              ) : dias <= 30 ? (
                <Badge tone="warn">Vence en {dias} {dias === 1 ? "día" : "días"}</Badge>
              ) : (
                <Badge tone="ok">Vigente</Badge>
              )}
              <Button variant="secondary" size="sm" onClick={() => setConfirmarQuitar(true)}>
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Todavía no has subido una firma electrónica.</p>
        )}
        {vencida && (
          <p role="alert" className="text-sm text-danger">
            Tu firma electrónica está vencida: los documentos se firmarán con tu firma dibujada hasta que subas una vigente.
          </p>
        )}

        <form onSubmit={guardar} className="space-y-3">
          <Field label={cert ? "Reemplazar certificado (.p12)" : "Certificado (.p12)"}>
            <input
              ref={inputRef}
              type="file"
              accept=".p12,.pfx,application/x-pkcs12"
              disabled={guardando}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </Field>
          <Field label="Contraseña de la firma">
            <Input
              type="password"
              autoComplete="off"
              value={password}
              disabled={guardando}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={guardando} disabled={!archivo || !password}>
            Guardar firma electrónica
          </Button>
        </form>
      </CardBody>

      <ConfirmarDialog
        open={confirmarQuitar}
        onCancel={() => setConfirmarQuitar(false)}
        onConfirm={quitar}
        title="¿Quitar la firma electrónica?"
        description="Se borra el certificado guardado. Tus documentos se firmarán con tu firma dibujada."
        confirmLabel="Sí, quitar"
      />
    </Card>
  );
}

function FirmaDibujadaCard() {
  const toast = useToast();
  const { firmaManuscritaAt, cargado } = usePerfilFirma();
  const [guardada, setGuardada] = useState<string | null>(null);
  const [nueva, setNueva] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [clave, setClave] = useState(0); // reinicia el lienzo tras guardar

  useEffect(() => {
    if (!firmaManuscritaAt) return;
    let vigente = true;
    obtenerFirmaManuscrita()
      .then((url) => vigente && setGuardada(url))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [firmaManuscritaAt]);

  const guardar = async () => {
    if (!nueva) return;
    setGuardando(true);
    try {
      await guardarFirmaManuscrita(nueva);
      toast.ok("Firma guardada.");
      setNueva(null);
      setClave((k) => k + 1);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Firma dibujada</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Dibújala con el mouse o con el dedo. Se usa en tus documentos cuando no firmas electrónicamente.
          </p>
        </div>

        {cargado && firmaManuscritaAt && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Firma actual</p>
            {guardada ? (
              <img src={guardada} alt="Tu firma guardada" className="h-24 rounded-md border border-line bg-white object-contain p-2" />
            ) : (
              <Skeleton className="h-24 w-48" />
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">{firmaManuscritaAt ? "Dibujar una nueva" : "Dibuja tu firma"}</p>
          <FirmaCanvas key={clave} onChange={setNueva} />
        </div>
        <Button onClick={guardar} loading={guardando} disabled={!nueva}>
          Guardar firma
        </Button>
      </CardBody>
    </Card>
  );
}

/** «Mi firma»: cada profesional gestiona su propia firma, electrónica o dibujada. */
export function MiFirmaPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Mi firma" description="Cómo salen firmados tus recetas, certificados, presupuestos y consentimientos." />
      <FirmaElectronicaCard />
      <FirmaDibujadaCard />
    </div>
  );
}
