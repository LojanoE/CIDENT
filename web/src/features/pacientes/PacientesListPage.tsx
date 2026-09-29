import { calcularEdad, type Centro, type Paciente } from "@cident/shared";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { PageHeader } from "../../components/layout";
import { DataList, EmptyState, SearchInput, Select, Skeleton, estiloBoton } from "../../components/ui";
import type { Columna } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { pacientesCollection } from "./pacientesApi";

function textoEdad(fechaNacimiento: string): string {
  const edad = calcularEdad(fechaNacimiento);
  return edad ? `${edad.anios} a ${edad.meses} m` : "—";
}

const COLUMNAS: Columna<Paciente>[] = [
  { id: "cedula", header: "Cédula", cell: (p) => <span className="font-mono">{p.cedula}</span> },
  { id: "apellidos", header: "Apellidos", cell: (p) => <span className="font-medium">{p.apellidos}</span> },
  { id: "nombres", header: "Nombres", cell: (p) => p.nombres },
  { id: "sexo", header: "Sexo", cell: (p) => p.sexo },
  { id: "edad", header: "Edad", cell: (p) => <span className="font-mono">{textoEdad(p.fechaNacimiento)}</span> },
  { id: "telefono", header: "Teléfono", cell: (p) => <span className="font-mono">{p.telefono || "—"}</span> },
];

function TarjetaPaciente({ p }: { p: Paciente }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {p.apellidos} {p.nombres}
        </p>
        <p className="font-mono text-13 text-ink-soft">{p.cedula}</p>
        <p className="text-13 text-ink-soft">
          {p.sexo} · {textoEdad(p.fechaNacimiento)}
          {p.telefono ? ` · ${p.telefono}` : ""}
        </p>
      </div>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink-soft" />
    </div>
  );
}

export function PacientesListPage() {
  const { sesion } = useAuth();
  const esAdmin = sesion?.rol === "admin";
  const [centros, setCentros] = useState<Centro[] | null>(null);

  useEffect(() => {
    if (!esAdmin) return;
    return onSnapshot(collection(db, "centros"), (snap) =>
      setCentros(snap.docs.map((d) => ({ centroId: d.id, ...d.data() }) as Centro)),
    );
  }, [esAdmin]);

  const centrosDisponibles = useMemo(
    () => (esAdmin ? (centros?.map((c) => c.centroId) ?? []) : [sesion!.centroId]),
    [esAdmin, centros, sesion],
  );
  const [centroSeleccionado, setCentroSeleccionado] = useState<string | undefined>(
    esAdmin ? undefined : sesion!.centroId,
  );
  const centroActivo = centroSeleccionado ?? centrosDisponibles[0];

  const [pacientes, setPacientes] = useState<Paciente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    if (!centroActivo) return;
    setPacientes(null);
    setError(null);
    const q = query(
      pacientesCollection(),
      where("centroId", "==", centroActivo),
      orderBy("apellidosLower"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPacientes(snap.docs.map((d) => d.data() as Paciente)),
      (err) => setError(mensajeError(err)),
    );
    return unsub;
  }, [centroActivo]);

  const filtrados = useMemo(() => {
    if (!pacientes) return null;
    const q = filtro.trim().toLowerCase();
    if (!q) return pacientes;
    return pacientes.filter(
      (p) =>
        p.apellidosLower.includes(q) || p.nombresLower.includes(q) || p.cedula.includes(q),
    );
  }, [pacientes, filtro]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Pacientes"
        description={pacientes ? `${pacientes.length} en el centro` : undefined}
        actions={
          <Link to="/pacientes/nuevo" className={estiloBoton()}>
            <UserPlus aria-hidden className="h-4 w-4" />
            Nuevo paciente
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {centrosDisponibles.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Centro</span>
            <Select
              value={centroActivo}
              onChange={(e) => setCentroSeleccionado(e.target.value)}
              className="w-auto"
            >
              {centrosDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        )}
        <SearchInput
          label="Buscar paciente"
          placeholder="Cédula o nombre…"
          onSearch={setFiltro}
          className="w-full sm:max-w-sm"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}

      {filtrados === null && !error && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {filtrados && filtrados.length === 0 && (
        <EmptyState
          icon={<Users aria-hidden className="h-8 w-8" />}
          title={filtro ? "Ningún paciente coincide" : "Aún no hay pacientes"}
          description={
            filtro
              ? "Revisa la ortografía o busca solo por cédula."
              : "Crea el primer paciente para empezar a registrar atenciones."
          }
          action={
            !filtro && (
              <Link to="/pacientes/nuevo" className={estiloBoton()}>
                Nuevo paciente
              </Link>
            )
          }
        />
      )}

      {filtrados && filtrados.length > 0 && (
        <DataList
          caption="Pacientes"
          items={filtrados}
          columns={COLUMNAS}
          rowKey={(p) => p.patientId}
          rowHref={(p) => `/pacientes/${p.patientId}`}
          renderCard={(p) => <TarjetaPaciente p={p} />}
        />
      )}
    </div>
  );
}
