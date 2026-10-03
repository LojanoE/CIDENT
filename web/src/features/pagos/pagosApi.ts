import type {
  AnularGastoInput,
  AnularPagoInput,
  Gasto,
  Pago,
  Presupuesto,
  RegistrarGastoInput,
  RegistrarPagoInput,
} from "@cident/shared";
import { collection, collectionGroup, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../app/firebase";

const registrarPagoCallable = httpsCallable<RegistrarPagoInput, { id: string; codigo: string; storagePath: string }>(
  functions,
  "registrarPago",
);
const anularPagoCallable = httpsCallable<AnularPagoInput, { ok: true }>(functions, "anularPago");
const registrarGastoCallable = httpsCallable<RegistrarGastoInput, { id: string }>(functions, "registrarGasto");
const anularGastoCallable = httpsCallable<AnularGastoInput, { ok: true }>(functions, "anularGasto");

export async function registrarPago(input: RegistrarPagoInput) {
  return (await registrarPagoCallable(input)).data;
}

export async function anularPago(input: AnularPagoInput) {
  return (await anularPagoCallable(input)).data;
}

export async function registrarGasto(input: RegistrarGastoInput) {
  return (await registrarGastoCallable(input)).data;
}

export async function anularGasto(input: AnularGastoInput) {
  return (await anularGastoCallable(input)).data;
}

/** Hoy en formato YYYY-MM-DD, en hora local (no UTC: un cobro de la noche no debe caer en «mañana»). */
export function hoyIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Pagos de un paciente, más recientes primero. */
export function suscribirPagosDePaciente(
  patientId: string,
  centroId: string,
  onData: (pagos: Pago[]) => void,
  onError: (err: unknown) => void,
) {
  const q = query(collection(db, "patients", patientId, "payments"), where("centroId", "==", centroId));
  return onSnapshot(
    q,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as Pago);
      lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(lista);
    },
    onError,
  );
}

/** Presupuestos aceptados de un paciente. */
export function suscribirPresupuestosAceptados(
  patientId: string,
  centroId: string,
  onData: (presupuestos: Presupuesto[]) => void,
  onError: (err: unknown) => void,
) {
  const q = query(
    collection(db, "patients", patientId, "budgets"),
    where("centroId", "==", centroId),
    where("estado", "==", "aceptado"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as Presupuesto);
      lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(lista);
    },
    onError,
  );
}

/** Pagos del centro con `fecha` en [desde, hasta] (ambos inclusive, YYYY-MM-DD). Collection group. */
export async function obtenerPagosDelRango(centroId: string, desde: string, hasta: string): Promise<Pago[]> {
  const q = query(
    collectionGroup(db, "payments"),
    where("centroId", "==", centroId),
    where("fecha", ">=", desde),
    where("fecha", "<=", hasta),
    orderBy("fecha", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Pago);
}

export async function obtenerGastosDelRango(centroId: string, desde: string, hasta: string): Promise<Gasto[]> {
  const q = query(
    collection(db, "centros", centroId, "gastos"),
    where("fecha", ">=", desde),
    where("fecha", "<=", hasta),
    orderBy("fecha", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Gasto);
}

/** Presupuestos aceptados del centro (base de las cuentas por cobrar). */
export async function obtenerPresupuestosAceptados(centroId: string): Promise<Presupuesto[]> {
  const q = query(collectionGroup(db, "budgets"), where("centroId", "==", centroId), where("estado", "==", "aceptado"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Presupuesto);
}

export const ETIQUETA_FORMA_PAGO = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
} as const;

export const ETIQUETA_CATEGORIA_GASTO = {
  insumos: "Insumos",
  alquiler: "Alquiler",
  servicios: "Servicios",
  sueldos: "Sueldos",
  laboratorio: "Laboratorio",
  otros: "Otros",
} as const;

export const dinero = (v: number) => `$ ${v.toFixed(2)}`;
