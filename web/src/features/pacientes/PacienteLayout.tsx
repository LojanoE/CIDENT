import { calcularEdad, type Paciente } from "@cident/shared";
import { AlertTriangle, ChevronLeft, ClipboardList, ListChecks, Plus, UserRound, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useMatch, useParams } from "react-router-dom";
import { PageHeader } from "../../components/layout";
import { Badge, EmptyState, Skeleton, Tabs, estiloBoton } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerPaciente } from "./pacientesApi";
import type { ContextoPaciente } from "./usePaciente";

/**
 * Barra de contexto del paciente: nombre, cédula, edad y alergias siempre a la vista, sea cual sea
 * la pestaña. Las alergias son un dato de seguridad clínica, no un campo más del formulario.
 */
export function PacienteLayout() {
  const { patientId } = useParams<{ patientId: string }>();
  const [paciente, setPaciente] = useState<Paciente | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Dentro de una atención las pestañas del paciente sobran: la atención trae las suyas.
  const enAtencion = useMatch("/pacientes/:patientId/atenciones/:atencion/*");
  const enAtencionNueva = useMatch("/pacientes/:patientId/atenciones/nueva");

  useEffect(() => {
    if (!patientId) return;
    let vigente = true;
    obtenerPaciente(patientId)
      .then((p) => vigente && setPaciente(p))
      .catch((err) => vigente && setError(mensajeError(err)));
    return () => {
      vigente = false;
    };
  }, [patientId]);

  const alActualizar = useCallback((cambios: Partial<Paciente>) => {
    setPaciente((actual) => (actual ? { ...actual, ...cambios } : actual));
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (paciente === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (paciente === null) {
    return (
      <EmptyState
        icon={<UserRound aria-hidden className="h-8 w-8" />}
        title="Paciente no encontrado"
        description="Puede que se haya eliminado o que pertenezca a otro centro."
        action={
          <Link to="/pacientes" className={estiloBoton()}>
            Volver a pacientes
          </Link>
        }
      />
    );
  }

  const edad = calcularEdad(paciente.fechaNacimiento);
  const contexto: ContextoPaciente = { paciente, alActualizar };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          <Link to="/pacientes" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Pacientes
          </Link>
        }
        title={`${paciente.apellidos} ${paciente.nombres}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{paciente.cedula}</span>
            <span>{edad ? `${edad.anios} años, ${edad.meses} meses` : "Edad no disponible"}</span>
            {paciente.alergias && (
              <Badge tone="danger" icon={<AlertTriangle aria-hidden className="h-3.5 w-3.5" />}>
                Alergias: {paciente.alergias}
              </Badge>
            )}
          </span>
        }
        actions={
          !enAtencionNueva && (
            <Link to={`/pacientes/${paciente.patientId}/atenciones/nueva`} className={estiloBoton()}>
              <Plus aria-hidden className="h-4 w-4" />
              Nueva atención
            </Link>
          )
        }
      />

      {!enAtencion && (
        <Tabs
          label="Secciones del paciente"
          className="mb-4"
          items={[
            { to: `/pacientes/${paciente.patientId}`, label: "Datos", end: true, icon: <UserRound aria-hidden className="h-4 w-4" /> },
            {
              to: `/pacientes/${paciente.patientId}/atenciones`,
              label: "Atenciones",
              end: true,
              icon: <ClipboardList aria-hidden className="h-4 w-4" />,
            },
            {
              to: `/pacientes/${paciente.patientId}/plan`,
              label: "Plan",
              icon: <ListChecks aria-hidden className="h-4 w-4" />,
            },
            {
              to: `/pacientes/${paciente.patientId}/pagos`,
              label: "Pagos",
              icon: <Wallet aria-hidden className="h-4 w-4" />,
            },
          ]}
        />
      )}

      <Outlet context={contexto} />
    </div>
  );
}
