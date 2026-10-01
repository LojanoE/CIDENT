import type { PresupuestoInput, TratamientoCatalogo } from "@cident/shared";
import { calcularTotalesPresupuesto, presupuestoSchema } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button, Field, Input, Textarea, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { generarPresupuesto, obtenerCatalogoTratamientos, obtenerIvaPorDefecto } from "./documentosApi";

const lineaVacia = { tratamiento: "", pieza: "", cantidad: 1, precioUnitario: 0 };

const porDefecto = (iva: number): PresupuestoInput => ({
  lineas: [lineaVacia],
  descuentoPorcentaje: 0,
  ivaPorcentaje: iva,
  validezDias: 30,
  observaciones: "",
});

const dinero = (v: number) => `$ ${v.toFixed(2)}`;
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Formulario de presupuesto: líneas libres con autocompletado del catálogo del centro (al elegir un
 * tratamiento ya usado se prellena su último precio) y totales en vivo con la misma fórmula del servidor.
 */
export function PresupuestoForm({
  patientId,
  visitId,
  centroId,
}: {
  patientId: string;
  visitId: string;
  centroId: string;
}) {
  const toast = useToast();
  const idCatalogo = useId();
  const [catalogo, setCatalogo] = useState<TratamientoCatalogo[]>([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PresupuestoInput>({ resolver: zodResolver(presupuestoSchema), defaultValues: porDefecto(0) });
  const { fields, append, remove } = useFieldArray({ control, name: "lineas" });

  const cargarCatalogo = () => obtenerCatalogoTratamientos(centroId).then(setCatalogo);

  useEffect(() => {
    let vigente = true;
    obtenerCatalogoTratamientos(centroId)
      .then((c) => vigente && setCatalogo(c))
      .catch(() => undefined); // el catálogo es una comodidad: sin él se escribe a mano
    obtenerIvaPorDefecto(centroId)
      .then((iva) => vigente && setValue("ivaPorcentaje", iva))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [centroId, setValue]);

  const lineas = useWatch({ control, name: "lineas" });
  const descuentoPct = useWatch({ control, name: "descuentoPorcentaje" });
  const ivaPct = useWatch({ control, name: "ivaPorcentaje" });

  const totales = useMemo(
    () =>
      calcularTotalesPresupuesto(
        (lineas ?? []).map((l) => ({ cantidad: numero(l?.cantidad), precioUnitario: numero(l?.precioUnitario) })),
        numero(descuentoPct),
        numero(ivaPct),
      ),
    [lineas, descuentoPct, ivaPct],
  );

  /** Al escribir o elegir un tratamiento del catálogo, prellena su último precio (editable). */
  const alCambiarTratamiento = (indice: number, nombre: string) => {
    const conocido = catalogo.find((t) => t.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (conocido) setValue(`lineas.${indice}.precioUnitario`, conocido.precioUnitario);
  };

  const enviar = async (values: PresupuestoInput) => {
    try {
      await generarPresupuesto({ ...values, patientId, visitId });
      reset(porDefecto(numero(getValues("ivaPorcentaje"))));
      void cargarCatalogo().catch(() => undefined);
      toast.ok("Presupuesto generado.");
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
      <datalist id={idCatalogo}>
        {catalogo.map((t) => (
          <option key={t.nombre} value={t.nombre} />
        ))}
      </datalist>

      <div className="space-y-3">
        {fields.map((campo, i) => {
          const errorLinea = errors.lineas?.[i];
          const totalLinea = totales.totalesLinea[i] ?? 0;
          return (
            <div key={campo.id} className="space-y-2 rounded-md border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <Field label="Tratamiento" error={errorLinea?.tratamiento?.message}>
                  <Input
                    list={idCatalogo}
                    autoComplete="off"
                    {...register(`lineas.${i}.tratamiento`, {
                      onChange: (e) => alCambiarTratamiento(i, e.target.value),
                    })}
                  />
                </Field>
                <Field label="Pieza" hint="Opcional" error={errorLinea?.pieza?.message}>
                  <Input {...register(`lineas.${i}.pieza`)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[6rem_9rem_1fr_auto]">
                <Field label="Cantidad" error={errorLinea?.cantidad?.message}>
                  <Input type="number" inputMode="numeric" min={1} {...register(`lineas.${i}.cantidad`)} />
                </Field>
                <Field label="Precio unitario" error={errorLinea?.precioUnitario?.message}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    {...register(`lineas.${i}.precioUnitario`)}
                  />
                </Field>
                <p className="text-sm sm:text-right">
                  <span className="text-ink-soft">Total: </span>
                  <span className="font-mono font-medium">{dinero(totalLinea)}</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={fields.length === 1}
                  aria-label={`Quitar el tratamiento ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {errors.lineas?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.lineas.message}
          </p>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => append(lineaVacia)}>
          <Plus aria-hidden className="h-4 w-4" />
          Agregar tratamiento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Descuento (%)" error={errors.descuentoPorcentaje?.message}>
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...register("descuentoPorcentaje")} />
        </Field>
        <Field label="IVA (%)" error={errors.ivaPorcentaje?.message}>
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" {...register("ivaPorcentaje")} />
        </Field>
        <Field label="Validez (días)" error={errors.validezDias?.message}>
          <Input type="number" inputMode="numeric" min={1} max={365} {...register("validezDias")} />
        </Field>
      </div>

      <Field label="Observaciones / forma de pago" error={errors.observaciones?.message}>
        <Textarea rows={2} {...register("observaciones")} />
      </Field>

      <dl className="ml-auto max-w-xs space-y-1 rounded-md bg-accent-wash p-3 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="font-mono">{dinero(totales.subtotal)}</dd>
        </div>
        {totales.descuento > 0 && (
          <div className="flex justify-between">
            <dt>Descuento</dt>
            <dd className="font-mono">- {dinero(totales.descuento)}</dd>
          </div>
        )}
        {totales.iva > 0 && (
          <div className="flex justify-between">
            <dt>IVA</dt>
            <dd className="font-mono">{dinero(totales.iva)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd className="font-mono">{dinero(totales.total)}</dd>
        </div>
      </dl>

      <Button type="submit" loading={isSubmitting}>
        Generar presupuesto
      </Button>
    </form>
  );
}
