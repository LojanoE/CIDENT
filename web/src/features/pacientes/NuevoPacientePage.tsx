import { pacienteSchema, type PacienteInput } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { PageHeader } from "../../components/layout";
import { Button, Card, CardBody, Field, Input, Select, Textarea } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { obtenerCita, vincularCitaAPaciente } from "../agenda/agendaApi";
import { crearPaciente } from "./pacientesApi";

export function NuevoPacientePage() {
  const { sesion } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const citaId = searchParams.get("citaId");
  const [error, setError] = useState<string | null>(null);
  const [precargada, setPrecargada] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PacienteInput>({
    resolver: zodResolver(pacienteSchema),
    defaultValues: {
      cedula: "",
      nombres: "",
      apellidos: "",
      sexo: "F",
      fechaNacimiento: "",
      telefono: "",
      direccion: "",
      email: "",
      alergias: "",
    },
  });

  // Al venir de una cita se precargan nombre y teléfono; el nombre de la cita es un
  // solo texto, así que se reparte a mitades y queda para que el usuario lo revise.
  useEffect(() => {
    if (!citaId) return;
    let activo = true;
    void obtenerCita(citaId)
      .then((cita) => {
        if (!activo || !cita || cita.centroId !== sesion?.centroId || cita.patientId) return;
        const palabras = cita.pacienteNombre.trim().split(/\s+/).filter(Boolean);
        const corte = Math.ceil(palabras.length / 2);
        setValue("nombres", palabras.slice(0, corte).join(" "));
        setValue("apellidos", palabras.slice(corte).join(" "));
        setValue("telefono", cita.pacienteTelefono ?? "");
        setPrecargada(true);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [citaId, sesion?.centroId, setValue]);

  const onSubmit = async (values: PacienteInput) => {
    setError(null);
    try {
      const patientId = await crearPaciente(values, sesion!.centroId, sesion!.uid);
      if (citaId && precargada) {
        try {
          await vincularCitaAPaciente(citaId, patientId, sesion!.uid);
        } catch {
          // La ficha ya existe; la cita puede vincularse después sin perder nada.
        }
      }
      navigate(`/pacientes/${patientId}`);
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <Link to="/pacientes" className="inline-flex items-center gap-1 hover:text-ink">
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Pacientes
          </Link>
        }
        title="Nuevo paciente"
      />

      {precargada && (
        <p className="mb-4 rounded-md border border-line bg-accent-wash px-3 py-2 text-13">
          Datos tomados de la cita. Revisa que los nombres y apellidos estén bien separados.
        </p>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cédula" error={errors.cedula?.message}>
                <Input inputMode="numeric" autoComplete="off" {...register("cedula")} />
              </Field>
              <Field label="Sexo" error={errors.sexo?.message}>
                <Select {...register("sexo")}>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                </Select>
              </Field>
              <Field label="Nombres" error={errors.nombres?.message}>
                <Input autoComplete="off" {...register("nombres")} />
              </Field>
              <Field label="Apellidos" error={errors.apellidos?.message}>
                <Input autoComplete="off" {...register("apellidos")} />
              </Field>
              <Field label="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
                <Input type="date" {...register("fechaNacimiento")} />
              </Field>
              <Field label="Teléfono" error={errors.telefono?.message}>
                <Input type="tel" autoComplete="off" {...register("telefono")} />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <Input type="email" autoComplete="off" {...register("email")} />
              </Field>
              <Field label="Dirección" error={errors.direccion?.message}>
                <Input autoComplete="off" {...register("direccion")} />
              </Field>
            </div>

            <Field
              label="Alergias"
              hint="Se mostrarán destacadas en toda la ficha del paciente."
              error={errors.alergias?.message}
            >
              <Textarea rows={3} {...register("alergias")} />
            </Field>

            {error && (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/pacientes" className="inline-flex min-h-touch items-center px-4 text-sm font-medium text-ink-soft hover:text-ink">
                Cancelar
              </Link>
              <Button type="submit" loading={isSubmitting}>
                Crear paciente
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
