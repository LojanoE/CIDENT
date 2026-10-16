import type { EtiquetarAdjuntoInput, TipoToma } from "@cident/shared";
import { collection, type Firestore } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable, type UploadTaskSnapshot } from "firebase/storage";
import { useEffect, useState } from "react";
import { db, functions, storage } from "../../app/firebase";

export function adjuntosCollection(patientId: string, firestore: Firestore = db) {
  return collection(firestore, "patients", patientId, "attachments");
}

export interface SubirAdjuntoParams {
  file: File;
  centroId: string;
  uid: string;
  patientId: string;
  visitId: string;
  /** Etiquetas opcionales; el trigger las valida y las copia al doc `attachments`. */
  toma?: TipoToma;
  piezas?: readonly number[];
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
  toma,
  piezas,
  onProgress,
}: SubirAdjuntoParams): Promise<void> {
  const nombreSeguro = file.name.replace(/[/\\]/g, "_");
  const ruta = `uploads/${centroId}/${uid}/${crypto.randomUUID()}_${nombreSeguro}`;
  const storageRef = ref(storage, ruta);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: {
        patientId,
        visitId,
        ...(toma ? { toma } : {}),
        ...(piezas && piezas.length > 0 ? { piezas: piezas.join(",") } : {}),
      },
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

const etiquetarAdjuntoCallable = httpsCallable<EtiquetarAdjuntoInput, void>(functions, "etiquetarAdjunto");

/** Corrige el tipo de toma y las piezas de un adjunto ya subido (solo el backend escribe `attachments`). */
export async function etiquetarAdjunto(input: EtiquetarAdjuntoInput): Promise<void> {
  await etiquetarAdjuntoCallable(input);
}

/** URL de descarga de un adjunto (para miniaturas); `null` mientras carga o si falla. */
export function useUrlAdjunto(storagePath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) return;
    let cancelado = false;
    obtenerUrlDescarga(storagePath)
      .then((u) => !cancelado && setUrl(u))
      .catch(() => !cancelado && setUrl(null));
    return () => {
      cancelado = true;
    };
  }, [storagePath]);
  return url;
}
