import { cuentasPorCobrar, resumenCaja, sumarMontos, type CuentaPorCobrar, type Pago, type ResumenCaja } from "@cident/shared";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { mensajeError } from "../../lib/mensajeError";
import { pacientesCollection } from "../pacientes/pacientesApi";
import { hoyIso, obtenerGastosDelRango, obtenerPagosDelRango, obtenerPresupuestosAceptados } from "../pagos/pagosApi";

const MAX_LISTA = 5;

export interface ResumenFinanciero {
  caja: ResumenCaja;
  cobradoHoy: number;
  porCobrar: number;
  ultimosCobros: Pago[];
  mayoresSaldos: CuentaPorCobrar[];
  /** patientId → "Apellidos Nombres", solo de los pacientes que se muestran. */
  nombres: Record<string, string>;
  hoy: string;
}

/** Resumen del mes en curso: caja, cuentas por cobrar y los movimientos más recientes. */
export function useResumenFinanciero(centroId: string | undefined) {
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    let vigente = true;
    setResumen(null);
    setError(null);
    (async () => {
      try {
        const hoy = hoyIso();
        const inicioMes = `${hoy.slice(0, 7)}-01`;
        const [pagos, gastos, presupuestos] = await Promise.all([
          obtenerPagosDelRango(centroId, inicioMes, hoy),
          obtenerGastosDelRango(centroId, inicioMes, hoy),
          obtenerPresupuestosAceptados(centroId),
        ]);
        const caja = resumenCaja(pagos, gastos);
        const cuentas = cuentasPorCobrar(presupuestos);
        const ultimosCobros = pagos
          .filter((p) => p.estado === "vigente")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, MAX_LISTA);
        const mayoresSaldos = cuentas.slice(0, MAX_LISTA);

        const ids = [...new Set([...ultimosCobros.map((p) => p.patientId), ...mayoresSaldos.map((c) => c.patientId)])];
        const nombres: Record<string, string> = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              const snap = await getDoc(doc(pacientesCollection(), id));
              const p = snap.data();
              if (p) nombres[id] = `${p.apellidos} ${p.nombres}`;
            } catch {
              // Sin nombre se muestra "Paciente": no vale tumbar el resumen por esto.
            }
          }),
        );

        if (!vigente) return;
        setResumen({
          caja,
          cobradoHoy: caja.ingresosPorDia.find((d) => d.fecha === hoy)?.monto ?? 0,
          porCobrar: sumarMontos(cuentas.map((c) => c.saldo)),
          ultimosCobros,
          mayoresSaldos,
          nombres,
          hoy,
        });
      } catch (err) {
        if (vigente) setError(mensajeError(err));
      }
    })();
    return () => {
      vigente = false;
    };
  }, [centroId]);

  return { resumen, error };
}
