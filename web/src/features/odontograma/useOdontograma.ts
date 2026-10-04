import type {
  EstadoDiente,
  EstadoZona,
  HigieneDoc,
  IndiceHigieneDiente,
  Odontograma,
  OdontogramaDoc,
  ResultadoCPO,
  TipoOdontograma,
  Zona,
} from "@cident/shared";
import { calcularCPO, calcularPromediosHigiene } from "@cident/shared";
import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { db } from "../../app/firebase";
import {
  actualizarCpoEHigiene,
  guardarHigiene,
  guardarOdontograma,
  obtenerHigiene,
  obtenerOdontograma,
  obtenerOdontogramaAnterior,
} from "./odontogramaApi";

const AUTOSAVE_MS = 1500;

type Indicador = "placa" | "calculo" | "gingivitis";

interface Estado {
  tipo: TipoOdontograma;
  dientes: Odontograma;
  higiene: Record<string, IndiceHigieneDiente>;
  sucio: boolean;
  /** Si el odontograma arrancó como copia del de una atención anterior. */
  copiadoDe?: OdontogramaDoc["copiadoDe"];
}

type Accion =
  | { tipo: "SET_ZONA"; fdi: number; zona: Zona; valor: EstadoZona }
  | { tipo: "CLEAR_ZONA"; fdi: number; zona: Zona }
  | { tipo: "SET_GENERAL"; fdi: number; valor: EstadoZona }
  | { tipo: "CLEAR_GENERAL"; fdi: number }
  | { tipo: "SET_TIPO"; valor: TipoOdontograma }
  | { tipo: "SET_HIGIENE"; fdi: number; indicador: Indicador; valor: number }
  | { tipo: "EMPEZAR_EN_BLANCO" }
  | { tipo: "RESET"; estado: Estado };

function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case "SET_ZONA": {
      const key = String(accion.fdi);
      const diente: EstadoDiente = estado.dientes[key] ?? { zonas: {} };
      return {
        ...estado,
        sucio: true,
        dientes: {
          ...estado.dientes,
          [key]: { ...diente, zonas: { ...diente.zonas, [accion.zona]: accion.valor } },
        },
      };
    }
    case "CLEAR_ZONA": {
      const key = String(accion.fdi);
      const diente = estado.dientes[key];
      if (!diente) return estado;
      const zonas = { ...diente.zonas };
      delete zonas[accion.zona];
      return { ...estado, sucio: true, dientes: { ...estado.dientes, [key]: { ...diente, zonas } } };
    }
    case "SET_GENERAL": {
      const key = String(accion.fdi);
      const diente: EstadoDiente = estado.dientes[key] ?? { zonas: {} };
      return {
        ...estado,
        sucio: true,
        dientes: { ...estado.dientes, [key]: { ...diente, general: accion.valor } },
      };
    }
    case "CLEAR_GENERAL": {
      const key = String(accion.fdi);
      const diente = estado.dientes[key];
      if (!diente) return estado;
      const resto: EstadoDiente = { zonas: diente.zonas };
      return { ...estado, sucio: true, dientes: { ...estado.dientes, [key]: resto } };
    }
    case "SET_TIPO":
      return { ...estado, sucio: true, tipo: accion.valor };
    case "SET_HIGIENE": {
      const key = String(accion.fdi);
      const registro = estado.higiene[key] ?? { placa: 0, calculo: 0, gingivitis: 0 };
      return {
        ...estado,
        sucio: true,
        higiene: { ...estado.higiene, [key]: { ...registro, [accion.indicador]: accion.valor } },
      };
    }
    case "EMPEZAR_EN_BLANCO":
      return { ...estado, sucio: true, dientes: {}, copiadoDe: undefined };
    case "RESET":
      return accion.estado;
    default:
      return estado;
  }
}

const ESTADO_VACIO: Estado = { tipo: "adulto", dientes: {}, higiene: {}, sucio: false };

interface UseOdontogramaOptions {
  patientId: string;
  visitId: string;
  centroId: string;
  uid: string;
  /** Fecha de la atención (YYYY-MM-DD): de ahí se busca el odontograma anterior a copiar. */
  fecha: string;
  soloLectura: boolean;
}

export function useOdontograma({ patientId, visitId, centroId, uid, fecha, soloLectura }: UseOdontogramaOptions) {
  const [estado, dispatch] = useReducer(reducir, ESTADO_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    Promise.all([obtenerOdontograma(patientId, visitId), obtenerHigiene(patientId, visitId)])
      .then(async ([odo, hig]) => {
        // Atención nueva sin odontograma propio: continúa el último del paciente (la higiene no se
        // copia, se mide en cada cita). `sucio` hace que el autosave lo guarde como propio.
        const anterior = !odo && !soloLectura ? await obtenerOdontogramaAnterior(patientId, centroId, visitId, fecha) : null;
        if (cancelado) return;
        dispatch({
          tipo: "RESET",
          estado: {
            tipo: odo?.tipo ?? anterior?.tipo ?? "adulto",
            dientes: odo?.dientes ?? anterior?.dientes ?? {},
            higiene: hig?.dientes ?? {},
            sucio: anterior !== null,
            copiadoDe: odo?.copiadoDe ?? (anterior ? { visitId: anterior.visitId, fecha: anterior.fecha } : undefined),
          },
        });
      })
      .catch((err) => !cancelado && setError(err instanceof Error ? err.message : "Error al cargar"))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [patientId, visitId, centroId, fecha, soloLectura]);

  // Refleja cambios de otra sesión editando la misma atención (último gana).
  useEffect(() => {
    if (cargando) return;
    const ref = doc(db, "patients", patientId, "visits", visitId, "detalle", "odontograma");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;
      const remoto = snap.data() as { tipo: TipoOdontograma; dientes: Odontograma; updatedBy: string };
      if (remoto.updatedBy === uid) return;
      if (estadoRef.current.sucio) return;
      dispatch({
        tipo: "RESET",
        estado: {
          tipo: remoto.tipo,
          dientes: remoto.dientes,
          higiene: estadoRef.current.higiene,
          sucio: false,
          copiadoDe: estadoRef.current.copiadoDe,
        },
      });
    });
    return unsub;
  }, [cargando, patientId, visitId, uid]);

  const cpo = useMemo<ResultadoCPO>(() => calcularCPO(estado.dientes), [estado.dientes]);
  const indicadores = useMemo(() => calcularPromediosHigiene({ dientes: estado.higiene }), [estado.higiene]);

  const guardarAhora = useCallback(async () => {
    if (soloLectura) return;
    const actual = estadoRef.current;
    if (!actual.sucio) return;
    setGuardando(true);
    setError(null);
    try {
      await Promise.all([
        guardarOdontograma(patientId, visitId, centroId, uid, actual.tipo, actual.dientes, actual.copiadoDe),
        guardarHigiene(patientId, visitId, centroId, actual.higiene),
      ]);
      await actualizarCpoEHigiene(
        patientId,
        visitId,
        calcularCPO(actual.dientes),
        calcularPromediosHigiene({ dientes: actual.higiene }),
      );
      dispatch({ tipo: "RESET", estado: { ...actual, sucio: false } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }, [patientId, visitId, centroId, uid, soloLectura]);

  useEffect(() => {
    if (!estado.sucio || soloLectura) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void guardarAhora();
    }, AUTOSAVE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [estado, soloLectura, guardarAhora]);

  // Aviso de navegación con cambios sin guardar (autosave aún pendiente).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return estadoRef.current.sucio && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (estadoRef.current.sucio) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const setZona = useCallback((fdi: number, zona: Zona, valor: EstadoZona) => {
    dispatch({ tipo: "SET_ZONA", fdi, zona, valor });
  }, []);
  const clearZona = useCallback((fdi: number, zona: Zona) => {
    dispatch({ tipo: "CLEAR_ZONA", fdi, zona });
  }, []);
  const setGeneral = useCallback((fdi: number, valor: EstadoZona) => {
    dispatch({ tipo: "SET_GENERAL", fdi, valor });
  }, []);
  const clearGeneral = useCallback((fdi: number) => {
    dispatch({ tipo: "CLEAR_GENERAL", fdi });
  }, []);
  const setTipo = useCallback((valor: TipoOdontograma) => {
    dispatch({ tipo: "SET_TIPO", valor });
  }, []);
  const empezarEnBlanco = useCallback(() => {
    dispatch({ tipo: "EMPEZAR_EN_BLANCO" });
  }, []);
  const setHigiene = useCallback((fdi: number, indicador: Indicador, valor: number) => {
    dispatch({ tipo: "SET_HIGIENE", fdi, indicador, valor });
  }, []);

  return {
    tipo: estado.tipo,
    dientes: estado.dientes,
    higiene: estado.higiene as HigieneDoc["dientes"],
    cargando,
    guardando,
    sucio: estado.sucio,
    copiadoDe: estado.copiadoDe,
    empezarEnBlanco,
    error,
    cpo,
    indicadores,
    setZona,
    clearZona,
    setGeneral,
    clearGeneral,
    setTipo,
    setHigiene,
    guardarAhora,
    blocker,
  };
}
