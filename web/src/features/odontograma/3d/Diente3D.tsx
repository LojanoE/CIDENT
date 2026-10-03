import type { EstadoDiente, Zona } from "@cident/shared";
import { ZONAS, apariencia, direccionDeZona, posicionPieza, tipoDePieza } from "@cident/shared";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useState } from "react";
import { Color, MeshStandardMaterial } from "three";
import { DIMENSIONES, EJES_GRUPOS, geometriaCorona, geometriaRaiz, raicesDe } from "./geometrias";

const ESMALTE = "#f3eee2";
const DENTINA = "#e6d6ae";
const ORO = "#d6a62a";
const FANTASMA = "#9aa3ad";
const SELECCION = "#2fb5ae";
const ENDODONCIA = "#e07b7b";
/** Por debajo de este desplazamiento (px) un clic cuenta como toque y no como arrastre de la cámara. */
const UMBRAL_ARRASTRE = 6;
const ESCALA_TEMPORAL = 0.85;

function esBlanco(color: string | null): boolean {
  return color === null || color.toLowerCase() === "#ffffff";
}

/** Zona clínica de cada uno de los 6 grupos de la caja (null = cara cervical). */
function zonasPorGrupo(fdi: number): Array<Zona | null> {
  const salida: Array<Zona | null> = EJES_GRUPOS.map(() => null);
  for (const zona of ZONAS) {
    const [dx, dy, dz] = direccionDeZona(fdi, zona);
    const i = EJES_GRUPOS.findIndex(([x, y, z]) => x === dx && y === dy && z === dz);
    if (i >= 0) salida[i] = zona;
  }
  return salida;
}

export interface Diente3DProps {
  fdi: number;
  estado: EstadoDiente | undefined;
  soloLectura: boolean;
  /** Zona seleccionada de este diente, si la selección es por zona. */
  seleccionada: Zona | null;
  generalSeleccionado: boolean;
  onZonaClick: (fdi: number, zona: Zona) => void;
  onGeneralClick: (fdi: number) => void;
}

function Diente3DBase({
  fdi,
  estado,
  soloLectura,
  seleccionada,
  generalSeleccionado,
  onZonaClick,
  onGeneralClick,
}: Diente3DProps) {
  const [hover, setHover] = useState(false);

  const tipo = tipoDePieza(fdi);
  const pos = useMemo(() => posicionPieza(fdi), [fdi]);
  const zonas = useMemo(() => zonasPorGrupo(fdi), [fdi]);
  const ap = useMemo(() => apariencia(estado), [estado]);

  const temporal = fdi >= 50;
  const factor = temporal ? ESCALA_TEMPORAL : 1;
  const dim = DIMENSIONES[tipo];
  const alto = dim.alto * factor;
  const profundidad = dim.profundidad * factor;
  const largoRaiz = dim.raiz * factor;

  const materiales = useMemo(
    () =>
      zonas.map((zona) => {
        const seleccionadoAqui = generalSeleccionado || (zona !== null && zona === seleccionada);
        const propio = zona ? ap.coloresZona[zona] : null;

        let color = ESMALTE;
        if (zona === null) color = DENTINA;
        else if (!esBlanco(propio)) color = propio as string;

        const m = new MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.02 });

        if (ap.ausente) {
          m.color = new Color(FANTASMA);
          m.transparent = true;
          m.opacity = 0.16;
          m.depthWrite = false;
        } else if (ap.corona && zona !== null) {
          m.color = new Color(ORO);
          m.metalness = 0.85;
          m.roughness = 0.25;
        } else if (ap.protesis && zona !== null && esBlanco(propio)) {
          m.color = new Color("#b9c6d2");
          m.metalness = 0.6;
          m.roughness = 0.3;
        }

        if (ap.extraccionIndicada && !ap.ausente) {
          m.emissive = new Color("#ff2d2d");
          m.emissiveIntensity = 0.25;
        }
        if (hover && !ap.ausente) {
          m.emissive = new Color("#ffffff");
          m.emissiveIntensity = 0.12;
        }
        if (seleccionadoAqui) {
          m.emissive = new Color(SELECCION);
          m.emissiveIntensity = 0.75;
        }
        return m;
      }),
    [zonas, ap, seleccionada, generalSeleccionado, hover],
  );

  useEffect(
    () => () => {
      for (const m of materiales) m.dispose();
    },
    [materiales],
  );

  const materialRaiz = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: ap.endodoncia ? ENDODONCIA : DENTINA,
      roughness: 0.5,
    });
    if (generalSeleccionado) {
      m.emissive = new Color(SELECCION);
      m.emissiveIntensity = 0.75;
    }
    return m;
  }, [ap.endodoncia, generalSeleccionado]);

  useEffect(() => () => materialRaiz.dispose(), [materialRaiz]);

  const corona = geometriaCorona(tipo);
  const raiz = geometriaRaiz();
  const raices = raicesDe(tipo, pos.invertido);

  function alPulsarCorona(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (e.delta > UMBRAL_ARRASTRE) return;
    const zona = zonas[e.face?.materialIndex ?? 3] ?? null;
    if (zona) onZonaClick(fdi, zona);
    else if (!soloLectura) onGeneralClick(fdi);
  }

  function alPulsarRaiz(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (e.delta > UMBRAL_ARRASTRE) return;
    if (!soloLectura) onGeneralClick(fdi);
  }

  function alDobleClic(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (!soloLectura) onGeneralClick(fdi);
  }

  function entrar(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  }

  function salir() {
    setHover(false);
    document.body.style.cursor = "";
  }

  // Al desmontar con el cursor encima no se dispara `pointerout`.
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  const mostrarEtiqueta = hover || seleccionada !== null || generalSeleccionado;

  return (
    <group position={[pos.x, pos.y, pos.z]} rotation={[0, pos.rotY, 0]}>
      {/* Marco local: oclusal en y=0, corona hacia -y; la arcada superior se espeja en y. */}
      <group scale={[1, pos.invertido ? -1 : 1, 1]}>
        <mesh
          geometry={corona}
          material={materiales}
          position={[0, -alto / 2, 0]}
          scale={[pos.ancho, alto, profundidad]}
          onClick={alPulsarCorona}
          onDoubleClick={alDobleClic}
          onPointerOver={entrar}
          onPointerOut={salir}
        />
        {!ap.ausente &&
          raices.map(({ dx, grosor }) => (
            <mesh
              key={dx}
              geometry={raiz}
              material={materialRaiz}
              position={[dx * pos.ancho, -alto - largoRaiz / 2 + 0.05, 0]}
              scale={[grosor * pos.ancho, largoRaiz, grosor * profundidad]}
              onClick={alPulsarRaiz}
              onDoubleClick={alDobleClic}
              onPointerOver={entrar}
              onPointerOut={salir}
            />
          ))}
      </group>
      {mostrarEtiqueta && (
        <Html position={[0, pos.invertido ? 0.9 : -0.9, 0.9]} center zIndexRange={[10, 0]}>
          <span className="pointer-events-none select-none rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-white shadow">
            {fdi}
          </span>
        </Html>
      )}
    </group>
  );
}

export const Diente3D = memo(Diente3DBase);
