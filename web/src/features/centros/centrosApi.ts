import type { Centro } from "@cident/shared";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";
import { db, storage } from "../../app/firebase";

const LOGO_RESPALDO = "/logo-cident.png";

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
 * URL del logo del centro. Si el centro no tiene logo propio, o la descarga
 * falla, cae al respaldo `logo-cident.png` servido por la propia app web.
 */
export function useLogoCentroUrl(centroId: string | undefined): string {
  const [url, setUrl] = useState<string>(LOGO_RESPALDO);

  useEffect(() => {
    if (!centroId) {
      setUrl(LOGO_RESPALDO);
      return;
    }
    return onSnapshot(doc(db, "centros", centroId), (snap) => {
      const centro = snap.data() as Centro | undefined;
      const storagePath = centro?.logo?.storagePath;
      if (!storagePath) {
        setUrl(LOGO_RESPALDO);
        return;
      }
      getDownloadURL(ref(storage, storagePath))
        .then(setUrl)
        .catch(() => setUrl(LOGO_RESPALDO));
    });
  }, [centroId]);

  return url;
}
