import type { CertificadoFirma, GuardarCertificadoFirmaInput, GuardarFirmaManuscritaInput } from "@cident/shared";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { db, functions } from "../../app/firebase";

const guardarCertificadoCallable = httpsCallable<GuardarCertificadoFirmaInput, CertificadoFirma>(
  functions,
  "guardarCertificadoFirma",
);
const eliminarCertificadoCallable = httpsCallable<void, { ok: boolean }>(functions, "eliminarCertificadoFirma");
const guardarManuscritaCallable = httpsCallable<GuardarFirmaManuscritaInput, { firmaManuscritaAt: string }>(
  functions,
  "guardarFirmaManuscrita",
);
const obtenerManuscritaCallable = httpsCallable<void, { dataUrl: string | null }>(functions, "obtenerFirmaManuscrita");

export async function guardarCertificadoFirma(input: GuardarCertificadoFirmaInput): Promise<CertificadoFirma> {
  return (await guardarCertificadoCallable(input)).data;
}

export async function eliminarCertificadoFirma(): Promise<void> {
  await eliminarCertificadoCallable();
}

export async function guardarFirmaManuscrita(pngBase64: string): Promise<void> {
  await guardarManuscritaCallable({ pngBase64 });
}

export async function obtenerFirmaManuscrita(): Promise<string | null> {
  return (await obtenerManuscritaCallable()).data.dataUrl;
}

/** Lee un archivo como base64 sin el prefijo `data:`. */
export function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const resultado = String(reader.result);
      resolve(resultado.slice(resultado.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export interface PerfilFirma {
  cargado: boolean;
  /** No se pudo leer el perfil (permisos o sin conexión). */
  fallo?: boolean;
  firmaElectronica?: CertificadoFirma;
  firmaManuscritaAt?: string;
}

/** Estado de la firma del usuario actual (su `users/{uid}`, que él puede leer). */
export function usePerfilFirma(): PerfilFirma {
  const { sesion } = useAuth();
  const uid = sesion?.uid;
  const [perfil, setPerfil] = useState<PerfilFirma>({ cargado: false });

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.data() as { firmaElectronica?: CertificadoFirma; firmaManuscritaAt?: string } | undefined;
        setPerfil({
          cargado: true,
          ...(d?.firmaElectronica ? { firmaElectronica: d.firmaElectronica } : {}),
          ...(d?.firmaManuscritaAt ? { firmaManuscritaAt: d.firmaManuscritaAt } : {}),
        });
      },
      // Sin poder leer el perfil no se sabe si hay firma electrónica: se marca el fallo
      // para no firmar en silencio con otra cosa (ver `useFirmaDocumento`).
      () => setPerfil({ cargado: true, fallo: true }),
    );
  }, [uid]);

  return perfil;
}

export function certificadoVencido(c: CertificadoFirma | undefined, ahora = Date.now()): boolean {
  return c !== undefined && new Date(c.validoHasta).getTime() < ahora;
}

/** Días que le quedan al certificado (negativo si ya venció). */
export function diasParaVencer(c: CertificadoFirma, ahora = Date.now()): number {
  return Math.floor((new Date(c.validoHasta).getTime() - ahora) / (24 * 3600 * 1000));
}
