import { CONDICIONES_ANAMNESIS, anamnesisSchema, anamnesisVacia, type AnamnesisInput } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../app/AuthProvider";
import { Button, Card, CardBody, Field, Textarea, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { guardarAnamnesis } from "./pacientesApi";
import { usePaciente } from "./usePaciente";

/** Pestaña «Ficha médica»: antecedentes que se muestran como alertas en todas las pantallas del paciente. */
export function FichaMedicaPage() {
  const { paciente, alActualizar } = usePaciente();
  const { sesion } = useAuth();
  const toast = useToast();
  const inicial = (): AnamnesisInput => anamnesisSchema.parse(paciente.anamnesis ?? anamnesisVacia());
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<AnamnesisInput>({ resolver: zodResolver(anamnesisSchema), defaultValues: inicial() });

  useEffect(() => {
    reset(inicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.anamnesis, reset]);

  if (!sesion) return null;
  const uid = sesion.uid;

  const onSubmit = async (values: AnamnesisInput) => {
    try {
      const anamnesis = await guardarAnamnesis(paciente.patientId, values, uid);
      alActualizar({ anamnesis });
      toast.ok("Ficha médica guardada.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Antecedentes</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDICIONES_ANAMNESIS.map((c) => (
                <label key={c.clave} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...register(c.clave)} />
                  {c.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Medicación actual">
            <Textarea rows={2} {...register("medicacion")} />
          </Field>
          <Field label="Otras enfermedades">
            <Textarea rows={2} {...register("enfermedades")} />
          </Field>
          <Field label="Cirugías previas">
            <Textarea rows={2} {...register("cirugias")} />
          </Field>
          <Field label="Observaciones">
            <Textarea rows={2} {...register("observaciones")} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <p className="text-13 text-ink-soft">
              {paciente.anamnesis?.actualizadaAt
                ? `Actualizada el ${paciente.anamnesis.actualizadaAt.slice(0, 10)}`
                : "Sin ficha médica registrada."}
            </p>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Guardar ficha
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
