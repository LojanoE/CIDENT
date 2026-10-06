import type { Certificado, Consentimiento, Paciente, CertificadoInput, EstadoPresupuesto, Presupuesto, Receta, RecetaInput } from "@cident/shared";
import { ESTADOS_PRESUPUESTO, alertasAnamnesis, certificadoSchema, recetaSchema } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { onSnapshot, query, where } from "firebase/firestore";
import { AlertTriangle, Download, FileText } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { Badge, Button, Card, CardBody, Field, Select, Textarea, useToast, type TonoBadge } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerUrlDescarga } from "../adjuntos/adjuntosApi";
import { useAtencion } from "../atenciones/useAtencion";
import { obtenerPaciente } from "../pacientes/pacientesApi";
import { importarPresupuestoAceptado } from "../plan/planApi";
import { ConsentimientoForm } from "./ConsentimientoForm";
import { PresupuestoForm } from "./PresupuestoForm";
import {
  actualizarEstadoPresupuesto,
  certificadosCollection,
  consentimientosCollection,
  generarCertificado,
  generarReceta,
  generarResumenAtencion,
  presupuestosCollection,
  recetasCollection,
} from "./documentosApi";

const recetaPorDefecto: RecetaInput = {
  diagnostico: "",
  indicaciones: "",
  medicamentos: "",
  recomendaciones: "",
};

const certificadoPorDefecto: CertificadoInput = {
  motivo: "",
  observaciones: "",
};

function RecetaForm({ patientId, visitId }: { patientId: string; visitId: string }) {
  const toast = useToast();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  useEffect(() => {
    let vigente = true;
    obtenerPaciente(patientId)
      .then((p) => vigente && setPaciente(p))
      .catch(() => undefined); // Las alertas son un aviso extra: sin ellas la receta se puede generar igual.
    return () => {
      vigente = false;
    };
  }, [patientId]);
  const alertas = paciente ? alertasAnamnesis(paciente.anamnesis, paciente.alergias).filter((a) => a.nivel === "alta") : [];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecetaInput>({ resolver: zodResolver(recetaSchema), defaultValues: recetaPorDefecto });

  const enviar = async (values: RecetaInput) => {
    try {
      await generarReceta({ ...values, patientId, visitId });
      reset(recetaPorDefecto);
      toast.ok("Receta generada.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-3">
      {alertas.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Tener en cuenta al recetar: {alertas.map((a) => a.texto).join(" · ")}</span>
        </div>
      )}
      <Field label="Diagnóstico" error={errors.diagnostico?.message}>
        <Textarea rows={2} {...register("diagnostico")} />
      </Field>
      <Field label="Indicaciones" error={errors.indicaciones?.message}>
        <Textarea rows={2} {...register("indicaciones")} />
      </Field>
      <Field label="Medicamentos" error={errors.medicamentos?.message}>
        <Textarea rows={2} {...register("medicamentos")} />
      </Field>
      <Field label="Recomendaciones" error={errors.recomendaciones?.message}>
        <Textarea rows={2} {...register("recomendaciones")} />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Generar receta
      </Button>
    </form>
  );
}

function CertificadoForm({ patientId, visitId }: { patientId: string; visitId: string }) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CertificadoInput>({ resolver: zodResolver(certificadoSchema), defaultValues: certificadoPorDefecto });

  const enviar = async (values: CertificadoInput) => {
    try {
      await generarCertificado({ ...values, patientId, visitId });
      reset(certificadoPorDefecto);
      toast.ok("Certificado generado.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-3">
      <Field label="Motivo" error={errors.motivo?.message}>
        <Textarea rows={2} {...register("motivo")} />
      </Field>
      <Field label="Observaciones" error={errors.observaciones?.message}>
        <Textarea rows={2} {...register("observaciones")} />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Generar certificado
      </Button>
    </form>
  );
}

function ResumenAtencionBoton({ patientId, visitId }: { patientId: string; visitId: string }) {
  const toast = useToast();
  const [generando, setGenerando] = useState(false);

  const generar = async () => {
    setGenerando(true);
    try {
      const { storagePath } = await generarResumenAtencion({ patientId, visitId });
      const url = await obtenerUrlDescarga(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Button type="button" variant="secondary" loading={generando} onClick={generar}>
      <FileText aria-hidden className="h-4 w-4" />
      Generar resumen de atención (PDF)
    </Button>
  );
}

const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};
const TONO_ESTADO: Record<EstadoPresupuesto, TonoBadge> = { pendiente: "warn", aceptado: "ok", rechazado: "danger" };

/** Estado del presupuesto: editable aunque la atención esté finalizada (el paciente decide después). */
function EstadoDelPresupuesto({ presupuesto, editable }: { presupuesto: Presupuesto; editable: boolean }) {
  const toast = useToast();
  const { sesion } = useAuth();

  const pagado = presupuesto.pagado ?? 0;
  // Con cobros registrados el estado queda fijo (también lo exigen las rules): hay que anular los pagos primero.
  if (!editable || !sesion || pagado > 0) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={TONO_ESTADO[presupuesto.estado]}>{ETIQUETA_ESTADO[presupuesto.estado]}</Badge>
        {presupuesto.estado === "aceptado" && (
          <Link to={`/pacientes/${presupuesto.patientId}/pagos`} className="text-13 text-accent hover:underline">
            Pagado $ {pagado.toFixed(2)} · Saldo $ {(presupuesto.total - pagado).toFixed(2)}
          </Link>
        )}
      </div>
    );
  }
  return (
    <Select
      aria-label={`Estado de ${presupuesto.codigoUnico}`}
      value={presupuesto.estado}
      className="min-w-32"
      onChange={async (e) => {
        const nuevo = e.target.value as EstadoPresupuesto;
        try {
          await actualizarEstadoPresupuesto(presupuesto.patientId, presupuesto.id, nuevo, sesion.uid);
        } catch (err) {
          toast.error(mensajeError(err));
          return;
        }
        // Aceptar un presupuesto lo lleva al plan de tratamiento; rechazarlo no toca el plan.
        if (nuevo !== "aceptado") return;
        try {
          const n = await importarPresupuestoAceptado(presupuesto, sesion.uid);
          if (n > 0) toast.ok(`${n} ${n === 1 ? "tratamiento agregado" : "tratamientos agregados"} al plan.`);
        } catch (err) {
          toast.error(`El presupuesto quedó aceptado, pero no se pudo agregar al plan: ${mensajeError(err)}`);
        }
      }}
    >
      {ESTADOS_PRESUPUESTO.map((e) => (
        <option key={e} value={e}>
          {ETIQUETA_ESTADO[e]}
        </option>
      ))}
    </Select>
  );
}

function ListaDocumentos<
  T extends { id: string; fecha: string; codigoUnico: string; archivo: { storagePath: string; nombre: string } },
>({
  titulo,
  documentos,
  etiqueta,
  acciones,
}: {
  titulo: string;
  documentos: T[];
  etiqueta: (doc: T) => string;
  acciones?: (doc: T) => ReactNode;
}) {
  const toast = useToast();
  const idTitulo = useId();

  const descargar = async (doc: T) => {
    try {
      const url = await obtenerUrlDescarga(doc.archivo.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <section aria-labelledby={idTitulo} className="space-y-2">
      <h4 id={idTitulo} className="text-sm font-medium">
        {titulo}
      </h4>
      {documentos.length === 0 ? (
        <p className="text-sm text-ink-soft">Todavía no se han generado.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-mono font-medium">{doc.codigoUnico}</p>
                <p className="truncate text-13 text-ink-soft">
                  {doc.fecha} · {etiqueta(doc)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {acciones?.(doc)}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Descargar ${doc.codigoUnico}`}
                  onClick={() => descargar(doc)}
                >
                  <Download aria-hidden className="h-4 w-4" />
                  Descargar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Pestaña «Documentos»: emite recetas y certificados, y lista lo ya emitido en esta atención. */
export function DocumentosPanel() {
  const { patientId, visitId } = useParams<{ patientId: string; visitId: string }>();
  const { atencion } = useAtencion();
  const centroId = atencion.centroId;
  const soloLectura = atencion.estado !== "draft";

  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [consentimientos, setConsentimientos] = useState<Consentimiento[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !visitId) return;
    const q = query(
      recetasCollection(patientId),
      where("visitId", "==", visitId),
      where("centroId", "==", centroId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as Receta);
        lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRecetas(lista);
      },
      (err) => setError(mensajeError(err)),
    );
  }, [patientId, visitId, centroId]);

  useEffect(() => {
    if (!patientId || !visitId) return;
    const q = query(
      certificadosCollection(patientId),
      where("visitId", "==", visitId),
      where("centroId", "==", centroId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as Certificado);
        lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCertificados(lista);
      },
      (err) => setError(mensajeError(err)),
    );
  }, [patientId, visitId, centroId]);

  useEffect(() => {
    if (!patientId || !visitId) return;
    const q = query(
      consentimientosCollection(patientId),
      where("visitId", "==", visitId),
      where("centroId", "==", centroId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as Consentimiento);
        lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setConsentimientos(lista);
      },
      (err) => setError(mensajeError(err)),
    );
  }, [patientId, visitId, centroId]);

  useEffect(() => {
    if (!patientId || !visitId) return;
    const q = query(
      presupuestosCollection(patientId),
      where("visitId", "==", visitId),
      where("centroId", "==", centroId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => d.data() as Presupuesto);
        lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setPresupuestos(lista);
      },
      (err) => setError(mensajeError(err)),
    );
  }, [patientId, visitId, centroId]);

  if (!patientId || !visitId) return null;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {soloLectura && (
        <p className="rounded-md border border-line bg-surface p-3 text-sm text-ink-soft">
          La atención está finalizada: solo puedes consultar y descargar los documentos ya emitidos.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <h3 className="text-base font-semibold">Receta</h3>
            {!soloLectura && <RecetaForm patientId={patientId} visitId={visitId} />}
            <ListaDocumentos titulo="Recetas emitidas" documentos={recetas} etiqueta={(r) => r.diagnostico || "—"} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h3 className="text-base font-semibold">Certificado</h3>
            {!soloLectura && <CertificadoForm patientId={patientId} visitId={visitId} />}
            <ListaDocumentos
              titulo="Certificados emitidos"
              documentos={certificados}
              etiqueta={(c) => c.motivo || "—"}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="text-base font-semibold">Consentimiento informado</h3>
          {!soloLectura && <ConsentimientoForm patientId={patientId} visitId={visitId} />}
          <ListaDocumentos
            titulo="Consentimientos firmados"
            documentos={consentimientos}
            etiqueta={(c) => `${c.titulo} · ${c.tratamiento}`}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="text-base font-semibold">Presupuesto</h3>
          {!soloLectura && <PresupuestoForm patientId={patientId} visitId={visitId} centroId={centroId} />}
          <ListaDocumentos
            titulo="Presupuestos emitidos"
            documentos={presupuestos}
            etiqueta={(p) =>
              `Total $ ${p.total.toFixed(2)} · ${p.lineas.length} ${p.lineas.length === 1 ? "tratamiento" : "tratamientos"}`
            }
            acciones={(p) => <EstadoDelPresupuesto presupuesto={p} editable={atencion.estado !== "anulada"} />}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Resumen de la atención</h3>
            <p className="text-13 text-ink-soft">Un PDF con la ficha, el odontograma y los índices de esta atención.</p>
          </div>
          <ResumenAtencionBoton patientId={patientId} visitId={visitId} />
        </CardBody>
      </Card>
    </div>
  );
}
