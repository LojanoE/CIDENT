import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * Devuelve a `pendiente` los ítems del plan que se marcaron como realizados en una atención que
 * deja de valer (eliminada o anulada). Devuelve cuántos revirtió.
 */
export async function revertirPlanDeVisita(
  patientId: string,
  visitId: string,
  centroId: string,
): Promise<number> {
  const db = getFirestore();
  const snap = await db
    .collection("patients")
    .doc(patientId)
    .collection("planTratamiento")
    .where("realizado.visitId", "==", visitId)
    .get();
  const propios = snap.docs.filter((d) => d.get("centroId") === centroId);
  if (propios.length === 0) return 0;

  const ahora = new Date().toISOString();
  const lote = db.batch();
  for (const d of propios) {
    lote.update(d.ref, { estado: "pendiente", realizado: FieldValue.delete(), updatedAt: ahora });
  }
  await lote.commit();
  return propios.length;
}
