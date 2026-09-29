import { collection, type Firestore } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTaskSnapshot } from "firebase/storage";
import { db, storage } from "../../app/firebase";

export function adjuntosCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "attachments");
}

export interface SubirAdjuntoParams {
  file: File;
  centroId: string;
  uid: string;
  patientId: string;
  visitId: string;
  onProgress?: (porcentaje: number) => void;
}

/**
 * Sube el archivo a la ruta de staging `uploads/{centroId}/{uid}/...`
 * (reanudable, validada por storage.rules). La Cloud Function
 * `onAdjuntoSubido` lo mueve a su ubicación definitiva y crea el documento
 * `attachments`; el listado reactivo (onSnapshot) lo refleja cuando eso termina.
 */
export function subirAdjunto({
  file,
  centroId,
  uid,
  patientId,
  visitId,
  onProgress,
}: SubirAdjuntoParams): Promise<void> {
  const nombreSeguro = file.name.replace(/[/\\]/g, "_");
  const ruta = `uploads/${centroId}/${uid}/${crypto.randomUUID()}_${nombreSeguro}`;
  const storageRef = ref(storage, ruta);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: { patientId, visitId },
    });
    task.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      () => resolve(),
    );
  });
}

export function obtenerUrlDescarga(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}
