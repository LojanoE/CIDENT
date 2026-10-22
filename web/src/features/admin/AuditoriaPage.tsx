import {
  ACCIONES_AUDITORIA,
  etiquetaAuditoria,
  fechaIsoSchema,
  type Usuario,
} from "@cident/shared";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../app/firebase";
import { PageHeader } from "../../components/layout";
import { Badge, Button, EmptyState, Field, Input, Select, Skeleton } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";

const PAGINA = 50;

interface RegistroAuditoria {
  id: string;
  accion: string;
  uid: string | null;
  entidad?: { tipo: string; id: string };
  detalle?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

/** Inicio del día local como ISO UTC, para filtrar `createdAt` (que se guarda en ISO UTC). */
const isoDeDia = (dia: string, sumarUnDia = false) => {
  const d = new Date(`${dia}T00:00:00`);
  if (sumarUnDia) d.setDate(d.getDate() + 1);
  return d.toISOString();
};

const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" });

/** Registro de auditoría del centro (solo admin): quién hizo qué y cuándo. */
export function AuditoriaPage() {
  const { sesion } = useAuth();
  const centroId = sesion?.centroId;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [accion, setAccion] = useState("");
  const [uid, setUid] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);
  const [ultimo, setUltimo] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Nombres de usuario del centro (las rules exigen filtrar por centroId).
  useEffect(() => {
    if (!centroId) return;
    return onSnapshot(
      query(collection(db, "users"), where("centroId", "==", centroId)),
      (snap) => setUsuarios(snap.docs.map((d) => d.data() as Usuario)),
      () => setUsuarios([]),
    );
  }, [centroId]);

  const nombreDe = useCallback(
    (u: string | null) => {
      if (!u) return "Paciente / sistema";
      const usuario = usuarios.find((x) => x.uid === u);
      return usuario?.nombreCompleto || usuario?.usuario || u.slice(0, 8);
    },
    [usuarios],
  );

  const restricciones = useCallback((): QueryConstraint[] => {
    const r: QueryConstraint[] = [where("centroId", "==", centroId)];
    if (accion) r.push(where("accion", "==", accion));
    if (uid) r.push(where("uid", "==", uid));
    if (fechaIsoSchema.safeParse(desde).success) r.push(where("createdAt", ">=", isoDeDia(desde)));
    if (fechaIsoSchema.safeParse(hasta).success) r.push(where("createdAt", "<", isoDeDia(hasta, true)));
    r.push(orderBy("createdAt", "desc"));
    return r;
  }, [centroId, accion, uid, desde, hasta]);

  const mapear = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
    docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RegistroAuditoria, "id">) }));

  useEffect(() => {
    if (!centroId) return;
    let vivo = true;
    setRegistros(null);
    setError(null);
    getDocs(query(collection(db, "auditLogs"), ...restricciones(), limit(PAGINA)))
      .then((snap) => {
        if (!vivo) return;
        setRegistros(mapear(snap.docs));
        setUltimo(snap.docs.at(-1) ?? null);
        setHayMas(snap.size === PAGINA);
      })
      .catch((err) => vivo && setError(mensajeError(err)));
    return () => {
      vivo = false;
    };
  }, [centroId, restricciones]);

  async function cargarMas() {
    if (!ultimo) return;
    setCargandoMas(true);
    try {
      const snap = await getDocs(
        query(collection(db, "auditLogs"), ...restricciones(), startAfter(ultimo), limit(PAGINA)),
      );
      setRegistros((prev) => [...(prev ?? []), ...mapear(snap.docs)]);
      setUltimo(snap.docs.at(-1) ?? ultimo);
      setHayMas(snap.size === PAGINA);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargandoMas(false);
    }
  }

  const hayFiltros = Boolean(accion || uid || desde || hasta);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administración"
        title="Auditoría"
        description="Registro de accesos y acciones sensibles de tu centro."
      />

      <details className="rounded-lg border border-line bg-surface" open={hayFiltros}>
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          Filtros{hayFiltros ? " (activos)" : ""}
          <ChevronDown aria-hidden className="h-4 w-4" />
        </summary>
        <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Acción">
            <Select value={accion} onChange={(e) => setAccion(e.target.value)}>
              <option value="">Todas</option>
              {ACCIONES_AUDITORIA.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAuditoria(a)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Usuario">
            <Select value={uid} onChange={(e) => setUid(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.nombreCompleto || u.usuario}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAccion("");
                setUid("");
                setDesde("");
                setHasta("");
              }}
            >
              Quitar filtros
            </Button>
          )}
        </div>
      </details>

      {error ? (
        <EmptyState title="No se pudo cargar la auditoría" description={error} />
      ) : !registros ? (
        <div className="space-y-2" role="status" aria-label="Cargando auditoría">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : registros.length === 0 ? (
        <EmptyState title="Sin registros" description="No hay eventos que coincidan con los filtros." />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {registros.map((r) => {
              const expandido = abierto === r.id;
              const tienePaciente = r.entidad?.tipo === "patients";
              return (
                <li key={r.id} className="p-3">
                  <button
                    type="button"
                    aria-expanded={expandido}
                    onClick={() => setAbierto(expandido ? null : r.id)}
                    className="flex min-h-touch w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium">{etiquetaAuditoria(r.accion)}</span>
                    <span className="flex flex-wrap items-center gap-2 text-13 text-ink-soft">
                      <span>{nombreDe(r.uid)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={r.createdAt}>{formatoFecha(r.createdAt)}</time>
                    </span>
                  </button>
                  {expandido && (
                    <div className="mt-2 space-y-2 rounded-md bg-bg p-3 text-13">
                      {r.entidad && (
                        <p>
                          <Badge>{r.entidad.tipo}</Badge>{" "}
                          {tienePaciente ? (
                            <Link className="text-accent underline" to={`/pacientes/${r.entidad.id}`}>
                              Ver paciente
                            </Link>
                          ) : (
                            <span className="font-mono">{r.entidad.id}</span>
                          )}
                        </p>
                      )}
                      {r.ip && <p className="text-ink-soft">IP: {r.ip}</p>}
                      {r.detalle && (
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
                          {JSON.stringify(r.detalle, null, 2)}
                        </pre>
                      )}
                      {!r.entidad && !r.ip && !r.detalle && <p className="text-ink-soft">Sin más detalle.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {hayMas && (
            <Button variant="secondary" className="w-full" onClick={() => void cargarMas()} loading={cargandoMas}>
              Cargar más
            </Button>
          )}
        </>
      )}
    </div>
  );
}
