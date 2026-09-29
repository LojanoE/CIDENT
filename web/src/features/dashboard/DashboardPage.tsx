import { ocupaFranja, rangoDelDia, type Cita } from "@cident/shared";
import { collection, collectionGroup, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { ArrowRight, UserPlus, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { Skeleton, estiloBoton } from "../../components/ui";
import { PageHeader } from "../../components/layout";
import { cn } from "../../lib/cn";
import { appointmentsCollection } from "../agenda/agendaApi";
import { hoyLocal } from "../agenda/fechas";
import { mensajeError } from "../../lib/mensajeError";

interface Contadores {
  pacientes: number;
  atenciones: number;
  borradores: number;
  citasHoy: number;
}

function useContadores(centroId: string | undefined) {
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId) return;
    setContadores(null);
    setError(null);
    (async () => {
      try {
        const { inicio, fin } = rangoDelDia(hoyLocal());
        const [pacientesSnap, atencionesSnap, borradoresSnap, citasSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "patients"), where("centroId", "==", centroId))),
          getCountFromServer(query(collectionGroup(db, "visits"), where("centroId", "==", centroId))),
          getCountFromServer(
            query(
              collectionGroup(db, "visits"),
              where("centroId", "==", centroId),
              where("estado", "==", "draft"),
            ),
          ),
          // Las de hoy son pocas: se leen y se descartan las liberadas (canceladas/ausentes)
          // en el cliente, así no hace falta un índice extra por estado.
          getDocs(
            query(
              appointmentsCollection(),
              where("centroId", "==", centroId),
              where("inicio", ">=", inicio),
              where("inicio", "<", fin),
            ),
          ),
        ]);
        setContadores({
          pacientes: pacientesSnap.data().count,
          atenciones: atencionesSnap.data().count,
          borradores: borradoresSnap.data().count,
          citasHoy: citasSnap.docs.filter((d) => ocupaFranja((d.data() as Cita).estado)).length,
        });
      } catch (err) {
        setError(mensajeError(err));
      }
    })();
  }, [centroId]);

  return { contadores, error };
}

export function DashboardPage() {
  const { sesion } = useAuth();
  const { contadores, error } = useContadores(sesion?.centroId);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Inicio"
        description={`Resumen del centro ${sesion?.centroId ?? ""}`}
        actions={
          <>
            <Link to="/pacientes" className={estiloBoton({ variant: "secondary" })}>
              <Users aria-hidden className="h-4 w-4" />
              Ver pacientes
            </Link>
            <Link to="/pacientes/nuevo" className={estiloBoton()}>
              <UserPlus aria-hidden className="h-4 w-4" />
              Nuevo paciente
            </Link>
          </>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && !contadores && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {contadores && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaContador etiqueta="Citas de hoy" valor={contadores.citasHoy} to="/agenda" />
          <TarjetaContador etiqueta="Pacientes" valor={contadores.pacientes} to="/pacientes" />
          <TarjetaContador etiqueta="Atenciones totales" valor={contadores.atenciones} />
          <TarjetaContador
            etiqueta="Borradores pendientes"
            valor={contadores.borradores}
            resaltar={contadores.borradores > 0}
          />
        </div>
      )}
    </div>
  );
}

function TarjetaContador({
  etiqueta,
  valor,
  to,
  resaltar,
}: {
  etiqueta: string;
  valor: number;
  to?: string;
  resaltar?: boolean;
}) {
  const contenido: ReactNode = (
    <>
      <p className="text-sm text-ink-soft">{etiqueta}</p>
      <p className={cn("mt-1 font-mono text-2xl font-medium", resaltar && "text-warn")}>{valor}</p>
      {to && (
        <ArrowRight aria-hidden className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
      )}
    </>
  );
  const clases = "relative block rounded-lg border border-line bg-surface p-4 shadow-card";

  return to ? (
    <Link to={to} className={cn(clases, "min-h-touch transition-colors hover:bg-accent-wash")}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
