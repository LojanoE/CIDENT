import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Button, Dialog, Field, Input, useToast } from "../../components/ui";
import { certificadoVencido, usePerfilFirma } from "./firmaApi";

export interface FirmaElectronicaEntrada {
  password: string;
}

type Respuesta = { password: string } | "dibujada" | null;

interface EstadoDialogo {
  error?: string;
  procesando: boolean;
  resolver: (r: Respuesta) => void;
}

function esContrasenaIncorrecta(err: unknown): boolean {
  return (err as { details?: { motivo?: string } } | null)?.details?.motivo === "contrasena_incorrecta";
}

function ClaveFirmaDialog({ estado, titular, onCerrar }: { estado: EstadoDialogo | null; titular: string; onCerrar: () => void }) {
  const [password, setPassword] = useState("");

  const confirmar = () => {
    if (!estado || !password) return;
    const clave = password;
    setPassword(""); // la contraseña no se queda en memoria de la pantalla
    estado.resolver({ password: clave });
  };

  return (
    <Dialog
      open={estado !== null}
      onClose={() => !estado?.procesando && onCerrar()}
      title="Firmar con tu firma electrónica"
      description={`Certificado de ${titular}. La contraseña se usa solo para firmar este documento y no se guarda.`}
      actions={
        <>
          <Button variant="secondary" disabled={estado?.procesando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={estado?.procesando}
            onClick={() => {
              setPassword("");
              estado?.resolver("dibujada");
            }}
          >
            Usar mi firma dibujada
          </Button>
          <Button loading={estado?.procesando} disabled={!password} onClick={confirmar}>
            Firmar
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        <Field label="Contraseña de la firma" error={estado?.error}>
          <Input
            type="password"
            autoComplete="off"
            autoFocus
            value={password}
            disabled={estado?.procesando}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}

/**
 * Envuelve la generación de un documento con su firma. Con firma electrónica vigente pide
 * la contraseña (y la vuelve a pedir si es incorrecta); sin ella genera directo, con la
 * firma dibujada del usuario. Devuelve `undefined` si el usuario cancela.
 */
export function useFirmaDocumento(): {
  conFirma: <T>(accion: (firma: FirmaElectronicaEntrada | undefined) => Promise<T>) => Promise<T | undefined>;
  dialogo: ReactNode;
} {
  const perfil = usePerfilFirma();
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoDialogo | null>(null);
  const cancelar = useRef<() => void>(() => undefined);

  const pedirClave = (error?: string) =>
    new Promise<Respuesta>((resolve) => {
      cancelar.current = () => resolve(null);
      setEstado({
        ...(error ? { error } : {}),
        procesando: false,
        resolver: (r) => {
          setEstado((prev) => (prev ? { ...prev, procesando: r !== null && r !== "dibujada" } : prev));
          resolve(r);
        },
      });
    });

  /** El perfil llega por un listener: se espera su primera lectura para no ignorar una firma electrónica. */
  const esperarPerfil = async () => {
    for (let i = 0; i < 100 && !perfilRef.current.cargado; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!perfilRef.current.cargado || perfilRef.current.fallo) {
      throw new Error("No se pudo comprobar tu firma electrónica. Revisa tu conexión e inténtalo de nuevo.");
    }
    return perfilRef.current;
  };

  const conFirma = async <T,>(accion: (firma: FirmaElectronicaEntrada | undefined) => Promise<T>) => {
    const cert = (await esperarPerfil()).firmaElectronica;
    if (!cert) return accion(undefined);
    if (certificadoVencido(cert)) {
      toast.info("Tu firma electrónica está vencida: se usó tu firma dibujada.");
      return accion(undefined);
    }

    let error: string | undefined;
    try {
      for (;;) {
        const respuesta = await pedirClave(error);
        if (respuesta === null) return undefined;
        if (respuesta === "dibujada") return await accion(undefined);
        try {
          return await accion({ password: respuesta.password });
        } catch (err) {
          if (!esContrasenaIncorrecta(err)) throw err;
          error = "La contraseña es incorrecta. Inténtalo de nuevo.";
        }
      }
    } finally {
      setEstado(null);
    }
  };

  const dialogo = (
    <ClaveFirmaDialog
      estado={estado}
      titular={perfil.firmaElectronica?.titular ?? ""}
      onCerrar={() => {
        cancelar.current();
        setEstado(null);
      }}
    />
  );

  return { conFirma, dialogo };
}
