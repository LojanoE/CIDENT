import type { Paciente, PlantillaConsentimiento } from "@cident/shared";
import { ETIQUETAS_CONSENTIMIENTO, PLANTILLAS_CONSENTIMIENTO, armarConsentimiento } from "@cident/shared";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { Button, Field, Input, Select, Textarea, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { useEnLinea } from "../../lib/useEnLinea";
import { useCentroActual } from "../centros/centrosApi";
import { obtenerPaciente } from "../pacientes/pacientesApi";
import { generarConsentimiento } from "./documentosApi";
import { FirmaCanvas } from "./FirmaCanvas";

/** Consentimiento informado: se elige la plantilla, se revisa el texto y el paciente firma en pantalla. */
export function ConsentimientoForm({ patientId, visitId }: { patientId: string; visitId: string }) {
  const toast = useToast();
  const { sesion } = useAuth();
  const enLinea = useEnLinea();
  const centro = useCentroActual(sesion?.centroId);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [profesional, setProfesional] = useState("");

  const [plantilla, setPlantilla] = useState<PlantillaConsentimiento>("general");
  const [tratamiento, setTratamiento] = useState("");
  const [pieza, setPieza] = useState("");
  const [texto, setTexto] = useState("");
  const [textoEditado, setTextoEditado] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [relacion, setRelacion] = useState<"paciente" | "representante">("paciente");
  const [nombreFirmante, setNombreFirmante] = useState("");
  const [cedulaFirmante, setCedulaFirmante] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const uid = sesion?.uid;
  useEffect(() => {
    let vigente = true;
    obtenerPaciente(patientId)
      .then((p) => vigente && setPaciente(p))
      .catch((err) => vigente && toast.error(mensajeError(err)));
    if (uid) {
      getDoc(doc(db, "users", uid))
        .then(
          (s) => vigente && setProfesional((s.data() as { nombreCompleto?: string } | undefined)?.nombreCompleto ?? ""),
        )
        .catch(() => undefined); // El nombre solo rellena el texto; el servidor usa el del usuario.
    }
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, uid]);

  const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}` : "";
  const textoPlantilla = useMemo(
    () =>
      armarConsentimiento(plantilla, {
        paciente: nombrePaciente,
        cedula: paciente?.cedula ?? "",
        tratamiento,
        pieza,
        profesional,
        centro: centro.nombre ?? "",
      }),
    [plantilla, nombrePaciente, paciente?.cedula, tratamiento, pieza, profesional, centro.nombre],
  );

  // Mientras el profesional no edite el texto a mano, sigue a la plantilla y a los datos.
  useEffect(() => {
    if (!textoEditado) setTexto(textoPlantilla);
  }, [textoPlantilla, textoEditado]);

  function empezarFirma() {
    if (!tratamiento.trim()) {
      toast.error("Indica el tratamiento.");
      return;
    }
    if (!paciente) return;
    setNombreFirmante(nombrePaciente);
    setCedulaFirmante(paciente.cedula);
    setRelacion("paciente");
    setFirma(null);
    setFirmando(true);
  }

  async function confirmar() {
    if (!firma) {
      toast.error("Falta la firma.");
      return;
    }
    setOcupado(true);
    try {
      await generarConsentimiento({
        patientId,
        visitId,
        plantilla,
        tratamiento,
        pieza: pieza.trim() || undefined,
        textoFinal: texto,
        firmaPaciente: firma,
        firmante: { nombre: nombreFirmante, cedula: cedulaFirmante, relacion },
      });
      toast.ok("Consentimiento generado.");
      setFirmando(false);
      setFirma(null);
      setTratamiento("");
      setPieza("");
      setTextoEditado(false);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  if (firmando) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Firma del consentimiento"
        className="fixed inset-0 z-50 overflow-y-auto bg-white p-4"
      >
        <div className="mx-auto max-w-2xl space-y-4">
          <h3 className="text-lg font-semibold">{ETIQUETAS_CONSENTIMIENTO[plantilla]}</h3>
          <p className="max-h-60 overflow-y-auto whitespace-pre-line rounded-md border border-line bg-surface p-3 text-sm">
            {texto}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Firma como">
              <Select
                value={relacion}
                onChange={(e) => {
                  const r = e.target.value as "paciente" | "representante";
                  setRelacion(r);
                  setNombreFirmante(r === "paciente" ? nombrePaciente : "");
                  setCedulaFirmante(r === "paciente" ? (paciente?.cedula ?? "") : "");
                }}
              >
                <option value="paciente">Paciente</option>
                <option value="representante">Representante legal</option>
              </Select>
            </Field>
            <Field label="Nombre de quien firma">
              <Input value={nombreFirmante} onChange={(e) => setNombreFirmante(e.target.value)} />
            </Field>
            <Field label="Cédula">
              <Input value={cedulaFirmante} onChange={(e) => setCedulaFirmante(e.target.value)} />
            </Field>
          </div>
          <FirmaCanvas onChange={setFirma} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFirmando(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmar()}
              loading={ocupado}
              disabled={!enLinea || !firma || !nombreFirmante.trim() || !cedulaFirmante.trim()}
            >
              Firmar y generar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Plantilla">
        <Select
          value={plantilla}
          onChange={(e) => {
            setPlantilla(e.target.value as PlantillaConsentimiento);
            setTextoEditado(false);
          }}
        >
          {PLANTILLAS_CONSENTIMIENTO.map((p) => (
            <option key={p} value={p}>
              {ETIQUETAS_CONSENTIMIENTO[p]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Tratamiento">
          <Input value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} />
        </Field>
        <Field label="Pieza (opcional)">
          <Input value={pieza} maxLength={10} onChange={(e) => setPieza(e.target.value)} />
        </Field>
      </div>
      <Field label="Texto del consentimiento">
        <Textarea
          rows={8}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setTextoEditado(true);
          }}
        />
      </Field>
      <Button type="button" onClick={empezarFirma} disabled={!paciente || !enLinea}>
        Firmar consentimiento
      </Button>
    </div>
  );
}
