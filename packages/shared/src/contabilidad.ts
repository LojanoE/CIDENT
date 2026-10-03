import { aCentavos, deCentavos } from "./presupuesto.js";
import type { FormaPago, Gasto, Pago, Presupuesto } from "./types.js";

/** Suma de montos en centavos enteros (0.1 + 0.2 da 0.3). */
export function sumarMontos(montos: number[]): number {
  return deCentavos(montos.reduce((acc, m) => acc + aCentavos(m), 0));
}

/** Saldo pendiente de un presupuesto; nunca negativo. */
export function saldoPresupuesto(total: number, pagado = 0): number {
  return deCentavos(Math.max(0, aCentavos(total) - aCentavos(pagado)));
}

export interface ResumenCaja {
  ingresos: number;
  egresos: number;
  balance: number;
  ingresosPorFormaPago: Partial<Record<FormaPago, number>>;
  /** Ingresos por día (YYYY-MM-DD), ordenados de más antiguo a más reciente. */
  ingresosPorDia: { fecha: string; monto: number }[];
}

type Movimiento = { monto: number; estado: "vigente" | "anulado" };

const vigentes = <T extends Movimiento>(movimientos: T[]) => movimientos.filter((m) => m.estado === "vigente");

/** Caja de un período: solo cuentan los movimientos vigentes. */
export function resumenCaja(pagos: Pago[], gastos: Gasto[]): ResumenCaja {
  const pagosVigentes = vigentes(pagos);
  const ingresos = pagosVigentes.reduce((a, p) => a + aCentavos(p.monto), 0);
  const egresos = vigentes(gastos).reduce((a, g) => a + aCentavos(g.monto), 0);

  const porForma = new Map<FormaPago, number>();
  const porDia = new Map<string, number>();
  for (const p of pagosVigentes) {
    porForma.set(p.formaPago, (porForma.get(p.formaPago) ?? 0) + aCentavos(p.monto));
    porDia.set(p.fecha, (porDia.get(p.fecha) ?? 0) + aCentavos(p.monto));
  }

  return {
    ingresos: deCentavos(ingresos),
    egresos: deCentavos(egresos),
    balance: deCentavos(ingresos - egresos),
    ingresosPorFormaPago: Object.fromEntries([...porForma].map(([k, v]) => [k, deCentavos(v)])),
    ingresosPorDia: [...porDia]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, monto]) => ({ fecha, monto: deCentavos(monto) })),
  };
}

export interface IngresoProfesional {
  profesionalUid: string;
  cobros: number;
  monto: number;
}

/** Ingresos por profesional, de mayor a menor. */
export function ingresosPorProfesional(pagos: Pago[]): IngresoProfesional[] {
  const mapa = new Map<string, { cobros: number; centavos: number }>();
  for (const p of vigentes(pagos)) {
    const actual = mapa.get(p.profesionalUid) ?? { cobros: 0, centavos: 0 };
    mapa.set(p.profesionalUid, { cobros: actual.cobros + 1, centavos: actual.centavos + aCentavos(p.monto) });
  }
  return [...mapa]
    .map(([profesionalUid, v]) => ({ profesionalUid, cobros: v.cobros, monto: deCentavos(v.centavos) }))
    .sort((a, b) => b.monto - a.monto);
}

export interface CuentaPorCobrar {
  patientId: string;
  saldo: number;
  presupuestos: { id: string; codigoUnico: string; total: number; pagado: number; saldo: number }[];
}

/** Presupuestos aceptados con saldo > 0, agrupados por paciente y ordenados por saldo descendente. */
export function cuentasPorCobrar(presupuestos: Presupuesto[]): CuentaPorCobrar[] {
  const mapa = new Map<string, CuentaPorCobrar & { centavos: number }>();
  for (const p of presupuestos) {
    if (p.estado !== "aceptado") continue;
    const saldo = saldoPresupuesto(p.total, p.pagado);
    if (saldo <= 0) continue;
    const cuenta = mapa.get(p.patientId) ?? { patientId: p.patientId, saldo: 0, presupuestos: [], centavos: 0 };
    cuenta.centavos += aCentavos(saldo);
    cuenta.presupuestos.push({
      id: p.id,
      codigoUnico: p.codigoUnico,
      total: p.total,
      pagado: p.pagado ?? 0,
      saldo,
    });
    mapa.set(p.patientId, cuenta);
  }
  return [...mapa.values()]
    .map(({ centavos, ...cuenta }) => ({ ...cuenta, saldo: deCentavos(centavos) }))
    .sort((a, b) => b.saldo - a.saldo);
}
