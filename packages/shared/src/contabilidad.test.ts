import { describe, expect, it } from "vitest";
import {
  cuentasPorCobrar,
  ingresosPorProfesional,
  resumenCaja,
  saldoPresupuesto,
  sumarMontos,
} from "./contabilidad.js";
import { anularPagoSchema, registrarGastoSchema, registrarPagoSchema } from "./schemas.js";
import type { Gasto, Pago, Presupuesto } from "./types.js";

const pago = (p: Partial<Pago>): Pago => ({
  id: "p",
  centroId: "c1",
  patientId: "pac1",
  concepto: "Abono",
  fecha: "2026-10-01",
  monto: 10,
  formaPago: "efectivo",
  profesionalUid: "u1",
  codigoUnico: "RC-20261001-001",
  archivo: { storagePath: "x", nombre: "x.pdf" },
  estado: "vigente",
  registradoPor: "u1",
  createdAt: "2026-10-01T10:00:00.000Z",
  ...p,
});

const gasto = (g: Partial<Gasto>): Gasto => ({
  id: "g",
  centroId: "c1",
  fecha: "2026-10-01",
  monto: 5,
  categoria: "insumos",
  descripcion: "Guantes",
  formaPago: "efectivo",
  estado: "vigente",
  registradoPor: "u1",
  createdAt: "2026-10-01T10:00:00.000Z",
  ...g,
});

const presupuesto = (p: Partial<Presupuesto>): Presupuesto =>
  ({
    id: "b1",
    centroId: "c1",
    patientId: "pac1",
    codigoUnico: "PS-20261001-001",
    estado: "aceptado",
    total: 100,
    pagado: 0,
    ...p,
  }) as Presupuesto;

describe("sumarMontos / saldoPresupuesto", () => {
  it("suma en centavos sin deriva de coma flotante", () => {
    expect(sumarMontos([0.1, 0.2])).toBe(0.3);
    expect(sumarMontos([])).toBe(0);
  });

  it("el saldo nunca es negativo", () => {
    expect(saldoPresupuesto(100, 40.5)).toBe(59.5);
    expect(saldoPresupuesto(100, 100)).toBe(0);
    expect(saldoPresupuesto(100, 120)).toBe(0);
    expect(saldoPresupuesto(100)).toBe(100);
  });
});

describe("resumenCaja", () => {
  it("ignora anulados y calcula balance, forma de pago y días", () => {
    const resumen = resumenCaja(
      [
        pago({ monto: 0.1, fecha: "2026-10-02" }),
        pago({ monto: 0.2, fecha: "2026-10-02", formaPago: "tarjeta" }),
        pago({ monto: 50, fecha: "2026-10-01" }),
        pago({ monto: 999, estado: "anulado" }),
      ],
      [gasto({ monto: 20 }), gasto({ monto: 500, estado: "anulado" })],
    );
    expect(resumen.ingresos).toBe(50.3);
    expect(resumen.egresos).toBe(20);
    expect(resumen.balance).toBe(30.3);
    expect(resumen.ingresosPorFormaPago).toEqual({ efectivo: 50.1, tarjeta: 0.2 });
    expect(resumen.ingresosPorDia).toEqual([
      { fecha: "2026-10-01", monto: 50 },
      { fecha: "2026-10-02", monto: 0.3 },
    ]);
  });
});

describe("ingresosPorProfesional", () => {
  it("agrupa por profesional, excluye anulados y ordena por monto", () => {
    const r = ingresosPorProfesional([
      pago({ profesionalUid: "a", monto: 10 }),
      pago({ profesionalUid: "b", monto: 30 }),
      pago({ profesionalUid: "a", monto: 5 }),
      pago({ profesionalUid: "a", monto: 1000, estado: "anulado" }),
    ]);
    expect(r).toEqual([
      { profesionalUid: "b", cobros: 1, monto: 30 },
      { profesionalUid: "a", cobros: 2, monto: 15 },
    ]);
  });
});

describe("cuentasPorCobrar", () => {
  it("solo presupuestos aceptados con saldo, agrupados por paciente", () => {
    const r = cuentasPorCobrar([
      presupuesto({ id: "b1", patientId: "x", total: 100, pagado: 40 }),
      presupuesto({ id: "b2", patientId: "x", total: 50 }),
      presupuesto({ id: "b3", patientId: "y", total: 70, pagado: 70 }),
      presupuesto({ id: "b4", patientId: "z", total: 500, estado: "pendiente" }),
      presupuesto({ id: "b5", patientId: "w", total: 10 }),
    ]);
    expect(r.map((c) => [c.patientId, c.saldo])).toEqual([
      ["x", 110],
      ["w", 10],
    ]);
    expect(r[0]!.presupuestos.map((p) => p.id)).toEqual(["b1", "b2"]);
  });
});

describe("schemas de pagos y gastos", () => {
  const base = { patientId: "pac1", monto: 25, formaPago: "efectivo", fecha: "2026-10-01" };

  it("un pago con presupuesto no necesita concepto", () => {
    expect(registrarPagoSchema.safeParse({ ...base, budgetId: "b1" }).success).toBe(true);
  });

  it("un pago sin presupuesto exige concepto", () => {
    expect(registrarPagoSchema.safeParse(base).success).toBe(false);
    expect(registrarPagoSchema.safeParse({ ...base, concepto: "Consulta" }).success).toBe(true);
  });

  it("tolera null (httpsCallable) en los opcionales", () => {
    const r = registrarPagoSchema.safeParse({ ...base, budgetId: "b1", concepto: null, referencia: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.referencia).toBeUndefined();
  });

  it("rechaza montos <= 0 o con más de 2 decimales", () => {
    expect(registrarPagoSchema.safeParse({ ...base, budgetId: "b1", monto: 0 }).success).toBe(false);
    expect(registrarPagoSchema.safeParse({ ...base, budgetId: "b1", monto: 10.123 }).success).toBe(false);
  });

  it("anular exige un motivo de al menos 5 caracteres", () => {
    expect(anularPagoSchema.safeParse({ patientId: "p", pagoId: "x", motivo: "mal" }).success).toBe(false);
    expect(anularPagoSchema.safeParse({ patientId: "p", pagoId: "x", motivo: "Error de monto" }).success).toBe(true);
  });

  it("un gasto exige descripción y categoría válida", () => {
    const g = { fecha: "2026-10-01", monto: 5, categoria: "insumos", descripcion: "Guantes", formaPago: "otro" };
    expect(registrarGastoSchema.safeParse(g).success).toBe(true);
    expect(registrarGastoSchema.safeParse({ ...g, descripcion: "" }).success).toBe(false);
    expect(registrarGastoSchema.safeParse({ ...g, categoria: "viajes" }).success).toBe(false);
  });
});
