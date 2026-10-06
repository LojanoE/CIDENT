import { getFirestore } from "firebase-admin/firestore";

export type TipoDocumentoCodigo = "receta" | "certificado" | "consentimiento" | "presupuesto" | "recibo";

const PREFIJOS: Record<TipoDocumentoCodigo, string> = {
  receta: "PR",
  certificado: "CE",
  consentimiento: "CO",
  presupuesto: "PS",
  recibo: "RC",
};

function formatearFecha(fecha: Date): string {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * Reserva y devuelve el siguiente código correlativo `PR-{yyyyMMdd}-{seq}` /
 * `CE-{yyyyMMdd}-{seq}` para un centro y día, vía `counters/{centroId}_{yyyyMMdd}`.
 *
 * Debe llamarse con la MISMA transacción que crea el documento (receta o
 * certificado), y después de cualquier otra lectura que esa transacción
 * necesite: Firestore no permite lecturas tras la primera escritura dentro
 * de una transacción, y esta función ya escribe el contador.
 */
export async function siguienteCodigo(
  tx: FirebaseFirestore.Transaction,
  centroId: string,
  tipo: TipoDocumentoCodigo,
  fecha: Date = new Date(),
): Promise<string> {
  const db = getFirestore();
  const yyyymmdd = formatearFecha(fecha);
  const ref = db.collection("counters").doc(`${centroId}_${yyyymmdd}`);

  const snap = await tx.get(ref);
  const datos = (snap.data() as Partial<Record<TipoDocumentoCodigo, number>>) ?? {};
  const siguiente = (datos[tipo] ?? 0) + 1;

  tx.set(ref, { [tipo]: siguiente }, { merge: true });

  const secuencia = String(siguiente).padStart(3, "0");
  return `${PREFIJOS[tipo]}-${yyyymmdd}-${secuencia}`;
}
