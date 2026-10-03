import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Marca como revocados los enlaces aún activos de un paciente. Devuelve cuántos. */
export async function revocarActivos(db: Firestore, centroId: string, patientId: string): Promise<number> {
  const snap = await db
    .collection("portalLinks")
    .where("patientId", "==", patientId)
    .where("revocado", "==", false)
    .get();
  const propios = snap.docs.filter((d) => d.get("centroId") === centroId);
  if (propios.length === 0) return 0;
  const batch = db.batch();
  for (const d of propios) batch.update(d.ref, { revocado: true });
  await batch.commit();
  return propios.length;
}
