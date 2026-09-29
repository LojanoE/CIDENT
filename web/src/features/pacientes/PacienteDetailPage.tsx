import { pacienteSchema, type PacienteInput } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button, Card, CardBody, Field, Input, Select, Textarea, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { actualizarPaciente } from "./pacientesApi";
import { usePaciente } from "./usePaciente";

/** Pestaña «Datos»: la ficha editable del paciente. La cédula es la clave de búsqueda y no se edita. */
export function PacienteDetailPage() {
  const { paciente, alActualizar } = usePaciente();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PacienteInput>({ resolver: zodResolver(pacienteSchema), defaultValues: paciente });

  useEffect(() => {
    reset(paciente);
  }, [paciente, reset]);

  const onSubmit = async (values: PacienteInput) => {
    try {
      const cambios: Omit<PacienteInput, "cedula"> & { cedula?: string } = { ...values };
      // La cédula es la clave natural del paciente: no se reescribe desde esta pantalla.
      delete cambios.cedula;
      await actualizarPaciente(paciente.patientId, cambios);
      alActualizar(cambios);
      toast.ok("Datos del paciente guardados.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cédula" hint="La cédula no se puede modificar.">
              <Input disabled readOnly value={paciente.cedula} className="font-mono" />
            </Field>
            <Field label="Sexo" error={errors.sexo?.message}>
              <Select {...register("sexo")}>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </Select>
            </Field>
            <Field label="Nombres" error={errors.nombres?.message}>
              <Input {...register("nombres")} />
            </Field>
            <Field label="Apellidos" error={errors.apellidos?.message}>
              <Input {...register("apellidos")} />
            </Field>
            <Field label="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
              <Input type="date" {...register("fechaNacimiento")} />
            </Field>
            <Field label="Teléfono" error={errors.telefono?.message}>
              <Input type="tel" {...register("telefono")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Dirección" error={errors.direccion?.message}>
              <Input {...register("direccion")} />
            </Field>
          </div>

          <Field
            label="Alergias"
            hint="Se muestran destacadas junto al nombre del paciente."
            error={errors.alergias?.message}
          >
            <Textarea rows={3} {...register("alergias")} />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
