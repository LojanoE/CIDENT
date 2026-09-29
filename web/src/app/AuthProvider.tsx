import type { LoginInput } from "@cident/shared";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, functions } from "./firebase";

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
      const idTokenResult = await user.getIdTokenResult();
      const centroId = idTokenResult.claims.centroId;
      const rol = idTokenResult.claims.rol;
      if (typeof centroId === "string" && (rol === "admin" || rol === "profesional")) {
        setSesion({ uid: user.uid, centroId, rol });
      } else {
        // El custom token aún no propagó los claims (poco frecuente, ver runbook F1).
        setSesion(null);
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
