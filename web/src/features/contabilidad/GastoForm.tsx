import type { RegistrarGastoInput } from "@cident/shared";
import { CATEGORIAS_GASTO, FORMAS_PAGO, registrarGastoSchema } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button, Dialog, Field, Input, Select, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { ETIQUETA_CATEGORIA_GASTO, ETIQUETA_FORMA_PAGO, hoyIso, registrarGasto } from "../pagos/pagosApi";

const inicial = (): RegistrarGastoInput => ({
  fecha: hoyIso(),
  monto: "" as unknown as number,
  categoria: "insumos",
  descripcion: "",
  formaPago: "efectivo",
});

export function GastoForm({
  open,
  onClose,
  onRegistrado,
}: {
  open: boolean;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegistrarGastoInput>({ resolver: zodResolver(registrarGastoSchema), defaultValues: inicial() });

  useEffect(() => {
    if (open) reset(inicial());
  }, [open, reset]);

  const enviar = async (values: RegistrarGastoInput) => {
    try {
      await registrarGasto(values);
      toast.ok("Gasto registrado.");
      onRegistrado();
      onClose();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar gasto"
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="form-gasto" loading={isSubmitting}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="form-gasto" onSubmit={handleSubmit(enviar)} noValidate className="space-y-3">
        <Field label="Descripción" required error={errors.descripcion?.message}>
          <Input {...register("descripcion")} placeholder="Ej.: resinas y anestesia" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto ($)" required error={errors.monto?.message}>
            <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("monto")} />
          </Field>
          <Field label="Fecha" required error={errors.fecha?.message}>
            <Input type="date" {...register("fecha")} />
          </Field>
          <Field label="Categoría" error={errors.categoria?.message}>
            <Select {...register("categoria")}>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CATEGORIA_GASTO[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Forma de pago" error={errors.formaPago?.message}>
            <Select {...register("formaPago")}>
              {FORMAS_PAGO.map((f) => (
                <option key={f} value={f}>
                  {ETIQUETA_FORMA_PAGO[f]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
