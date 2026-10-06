import type { Centro } from "@cident/shared";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import { db, storage } from "../../app/firebase";

export const LOGO_RESPALDO = "/logo-respaldo.png";

export function useCentros(): Centro[] | null {
  const [centros, setCentros] = useState<Centro[] | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "centros"), (snap) =>
      setCentros(snap.docs.map((d) => ({ centroId: d.id, ...d.data() }) as Centro)),
    );
  }, []);

  return centros;
}

/**
 * Nombre y logo del centro actual, con una sola suscripción en vivo. Si el
 * centro no tiene logo propio, o la descarga falla, el logo cae al respaldo
 * `logo-respaldo.png` (Luna-Dental) servido por la propia app web.
 * `nombre` es `null` mientras carga.
 */
export function useCentroActual(centroId: string | undefined): {
  nombre: string | null;
  logoUrl: string;
  plantillaRecordatorio?: string;
  direccion?: string;
  telefono?: string;
} {
  const [logoUrl, setLogoUrl] = useState<string>(LOGO_RESPALDO);
  const [nombre, setNombre] = useState<string | null>(null);
  const [datos, setDatos] = useState<{ plantillaRecordatorio?: string; direccion?: string; telefono?: string }>({});

  useEffect(() => {
    setNombre(null);
    setDatos({});
    if (!centroId) {
      setLogoUrl(LOGO_RESPALDO);
      return;
    }
    return onSnapshot(doc(db, "centros", centroId), (snap) => {
      const centro = snap.data() as Centro | undefined;
      setNombre(centro?.nombre || centroId);
      setDatos({
        plantillaRecordatorio: centro?.plantillaRecordatorio,
        direccion: centro?.direccion,
        telefono: centro?.telefono,
      });
      const storagePath = centro?.logo?.storagePath;
      if (!storagePath) {
        setLogoUrl(LOGO_RESPALDO);
        return;
      }
      getDownloadURL(ref(storage, storagePath))
        .then(setLogoUrl)
        .catch(() => setLogoUrl(LOGO_RESPALDO));
    });
  }, [centroId]);

  return { nombre, logoUrl, ...datos };
}

/** URL del logo del centro (ver `useCentroActual`). */
export function useLogoCentroUrl(centroId: string | undefined): string {
  return useCentroActual(centroId).logoUrl;
}
