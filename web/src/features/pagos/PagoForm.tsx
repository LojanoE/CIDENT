import type { Presupuesto, RegistrarPagoInput } from "@cident/shared";
import { FORMAS_PAGO, registrarPagoSchema, saldoPresupuesto } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, Dialog, Field, Input, Select, useToast } from "../../components/ui";
import { useAuth } from "../../app/AuthProvider";
import { mensajeError } from "../../lib/mensajeError";
import { useProfesionalesDelCentro } from "../agenda/useAgenda";
import { ETIQUETA_FORMA_PAGO, dinero, hoyIso, registrarPago } from "./pagosApi";

const SIN_PRESUPUESTO = "";

/** Saldo del presupuesto, o vacío (el input numérico lo muestra sin valor) si es un pago suelto. */
const montoInicial = (p?: Presupuesto): number =>
  p ? saldoPresupuesto(p.total, p.pagado) : ("" as unknown as number);

/** Diálogo de cobro: contra un presupuesto aceptado (monto prellenado con el saldo) o suelto con concepto. */
export function PagoForm({
  open,
  onClose,
  patientId,
  presupuestos,
  presupuestoInicial,
  onRegistrado,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  /** Presupuestos aceptados con saldo pendiente. */
  presupuestos: Presupuesto[];
  presupuestoInicial?: string;
  onRegistrado: (storagePath: string) => void;
}) {
  const toast = useToast();
  const { sesion } = useAuth();
  const { profesionales } = useProfesionalesDelCentro(sesion?.centroId);

  const valoresIniciales = (budgetId: string): RegistrarPagoInput => {
    const presupuesto = presupuestos.find((p) => p.id === budgetId);
    return {
      patientId,
      budgetId,
      concepto: "",
      monto: montoInicial(presupuesto),
      formaPago: "efectivo",
      fecha: hoyIso(),
      referencia: "",
      profesionalUid: "",
    };
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegistrarPagoInput>({
    resolver: zodResolver(registrarPagoSchema),
    defaultValues: valoresIniciales(presupuestoInicial ?? SIN_PRESUPUESTO),
  });
  const budgetId = useWatch({ control, name: "budgetId" }) ?? SIN_PRESUPUESTO;

  useEffect(() => {
    if (open) reset(valoresIniciales(presupuestoInicial ?? presupuestos[0]?.id ?? SIN_PRESUPUESTO));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presupuestoInicial]);

  const alElegirPresupuesto = (id: string) => {
    const presupuesto = presupuestos.find((p) => p.id === id);
    setValue("monto", montoInicial(presupuesto));
  };

  const enviar = async (values: RegistrarPagoInput) => {
    try {
      const { storagePath } = await registrarPago({ ...values, patientId });
      toast.ok("Pago registrado.");
      onRegistrado(storagePath);
      onClose();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar pago"
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="form-pago" loading={isSubmitting}>
            Registrar y generar recibo
          </Button>
        </>
      }
    >
      <form id="form-pago" onSubmit={handleSubmit(enviar)} noValidate className="space-y-3">
        <Field label="Presupuesto" error={errors.budgetId?.message}>
          <Select
            {...register("budgetId", { onChange: (e) => alElegirPresupuesto(e.target.value) })}
          >
            <option value={SIN_PRESUPUESTO}>Sin presupuesto (pago suelto)</option>
            {presupuestos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigoUnico} · saldo {dinero(saldoPresupuesto(p.total, p.pagado))}
              </option>
            ))}
          </Select>
        </Field>
        {budgetId === SIN_PRESUPUESTO && (
          <Field label="Concepto" required error={errors.concepto?.message}>
            <Input {...register("concepto")} placeholder="Ej.: consulta, limpieza" />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto ($)" required error={errors.monto?.message}>
            <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("monto")} />
          </Field>
          <Field label="Fecha" required error={errors.fecha?.message}>
            <Input type="date" {...register("fecha")} />
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
          <Field label="Referencia" error={errors.referencia?.message}>
            <Input {...register("referencia")} placeholder="N.º de transferencia, voucher…" />
          </Field>
        </div>
        <Field label="Profesional" hint="Si no eliges, se atribuye al del presupuesto o a quien registra.">
          <Select {...register("profesionalUid")}>
            <option value="">Automático</option>
            {profesionales?.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.nombreCompleto}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}
