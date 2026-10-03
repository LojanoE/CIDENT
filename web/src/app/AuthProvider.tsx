import type { LoginInput } from "@cident/shared";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, functions } from "./firebase";

export interface Sesion {
  uid: string;
  centroId: string;
  rol: "admin" | "profesional";
}

interface AuthContextValue {
  usuario: User | null;
  sesion: Sesion | null;
  cargando: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const CLAVE_SESION = "cident.sesion";

function leerSesionGuardada(uid: string): Sesion | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(CLAVE_SESION) ?? "null") as Sesion | null;
    return s && s.uid === uid && typeof s.centroId === "string" && (s.rol === "admin" || s.rol === "profesional")
      ? s
      : null;
  } catch {
    return null;
  }
}

function guardarSesion(sesion: Sesion | null) {
  try {
    if (sesion) window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else window.localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento: la sesión offline simplemente no estará disponible.
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  token: string;
}

/**
 * Login propio (NO Firebase Auth con proveedor externo): la Cloud Function
 * `login` verifica usuario+contraseña contra `users/{uid}` (argon2id) y
 * devuelve un custom token ya con `centroId`/`rol` fijados vía
 * `setCustomUserClaims`. Aquí solo se intercambia ese token por una sesión.
 */
const loginCallable = httpsCallable<LoginInput, LoginResponse>(functions, "login");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (!user) {
        setSesion(null);
        setCargando(false);
        return;
      }
      try {
        const idTokenResult = await user.getIdTokenResult();
        const centroId = idTokenResult.claims.centroId;
        const rol = idTokenResult.claims.rol;
        if (typeof centroId === "string" && (rol === "admin" || rol === "profesional")) {
          const nueva: Sesion = { uid: user.uid, centroId, rol };
          guardarSesion(nueva);
          setSesion(nueva);
        } else {
          // El custom token aún no propagó los claims (poco frecuente, ver runbook F1).
          setSesion(null);
        }
      } catch {
        // Sin red y con el token vencido no se puede refrescar: se usa la sesión
        // guardada para poder consultar la agenda en caché.
        setSesion(leerSesionGuardada(user.uid));
      }
      setCargando(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      sesion,
      cargando,
      async login(input) {
        const { data } = await loginCallable(input);
        await signInWithCustomToken(auth, data.token);
      },
      async logout() {
        await firebaseSignOut(auth);
        guardarSesion(null);
        // Un dispositivo compartido no debe conservar datos de pacientes en la caché local.
        try {
          await terminate(db);
          await clearIndexedDbPersistence(db);
        } catch {
          // Si falla la limpieza igualmente se recarga la página.
        }
        window.location.reload();
      },
    }),
    [usuario, sesion, cargando],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
