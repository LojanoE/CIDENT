import type { EstadoDiente, Zona } from "@cident/shared";
import { ZONAS, apariencia, direccionDeZona, posicionPieza, tipoDePieza } from "@cident/shared";
import { Html, Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useState } from "react";
import {
  DIMENSIONES,
  EJES_GRUPOS,
  alturaCentroOclusal,
  geometriaConducto,
  geometriaCorona,
  geometriaRaiz,
  raicesDe,
} from "./geometrias";
import type { Emisivo, TipoMaterialCorona } from "./materiales";
import { COLORES, materialConducto, materialCorona, materialRaiz } from "./materiales";

/** Por debajo de este desplazamiento (px) un clic cuenta como toque y no como arrastre de la cámara. */
const UMBRAL_ARRASTRE = 6;
const ESCALA_TEMPORAL = 0.85;

function esBlanco(color: string | null): boolean {
  return color === null || color.toLowerCase() === "#ffffff";
}

/** Zona clínica de cada uno de los 6 grupos de la corona (null = cara cervical). */
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
  /** Con encía visible las raíces quedan ocultas; sin ella se ven (y el conducto de una endodoncia). */
  encia: boolean;
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
  encia,
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
  const signoDistal = useMemo(() => Math.sign(direccionDeZona(fdi, "distal")[0]) || 1, [fdi]);

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

        let emisivo: Emisivo = "ninguno";
        if (ap.extraccionIndicada && !ap.ausente) emisivo = "extraccion";
        if (hover && !ap.ausente) emisivo = "hover";
        if (seleccionadoAqui) emisivo = "seleccion";

        let material: TipoMaterialCorona = "esmalte";
        if (ap.ausente) material = "fantasma";
        else if (ap.corona && zona !== null) material = "oro";
        else if (ap.protesis && zona !== null && esBlanco(propio)) material = "protesis";

        return materialCorona({
          material,
          color: zona !== null && !esBlanco(propio) ? propio : null,
          emisivo,
        });
      }),
    [zonas, ap, seleccionada, generalSeleccionado, hover],
  );

  const verRaices = !ap.ausente && !encia;
  const raizTranslucida = ap.endodoncia && verRaices;
  const materialDeRaiz = materialRaiz(raizTranslucida, generalSeleccionado ? "seleccion" : "ninguno");

  const corona = geometriaCorona(tipo);
  const raiz = geometriaRaiz();
  const conducto = geometriaConducto();
  const raices = raicesDe(tipo, pos.invertido);
  const yOclusal = -alto * (0.5 - alturaCentroOclusal(tipo));

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
  const contorno = !ap.ausente && (hover || seleccionada !== null || generalSeleccionado);

  return (
    <group position={[pos.x, pos.y, pos.z]} rotation={[0, pos.rotY, 0]}>
      {/* Marco local: oclusal en y=0, corona hacia -y; la arcada superior se espeja en y. */}
      <group scale={[1, pos.invertido ? -1 : 1, 1]}>
        <mesh
          geometry={corona}
          material={materiales}
          position={[0, -alto / 2, 0]}
          scale={[pos.ancho, alto, profundidad]}
          castShadow
          receiveShadow
          onClick={alPulsarCorona}
          onDoubleClick={alDobleClic}
          onPointerOver={entrar}
          onPointerOut={salir}
        >
          {contorno && (
            <Outlines
              thickness={0.03}
              color={seleccionada !== null || generalSeleccionado ? COLORES.SELECCION : "#ffffff"}
            />
          )}
        </mesh>

        {verRaices &&
          raices.map(({ dx, grosor }) => (
            <group key={dx} position={[dx * pos.ancho, -alto - largoRaiz / 2 + 0.05, 0]}>
              <mesh
                geometry={raiz}
                material={materialDeRaiz}
                scale={[signoDistal * grosor * pos.ancho, largoRaiz, grosor * profundidad]}
                castShadow
                receiveShadow
                onClick={alPulsarRaiz}
                onDoubleClick={alDobleClic}
                onPointerOver={entrar}
                onPointerOut={salir}
              />
              {raizTranslucida && (
                <mesh
                  geometry={conducto}
                  material={materialConducto()}
                  position={[signoDistal * grosor * pos.ancho * 0.04, 0, 0]}
                  scale={[0.14 * grosor * pos.ancho, largoRaiz * 0.9, 0.14 * grosor * profundidad]}
                  raycast={() => null}
                />
              )}
            </group>
          ))}

        {ap.endodoncia && !ap.ausente && (
          // Punto de acceso a la cámara pulpar, embutido en el centro de la cara oclusal.
          <mesh position={[0, yOclusal, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.13 * factor, 0.13 * factor, 0.05, 16]} />
            <meshStandardMaterial color={COLORES.ENDODONCIA} roughness={0.4} />
          </mesh>
        )}

        {ap.extraccionIndicada && !ap.ausente && (
          // «X» roja que flota delante de la cara vestibular, visible aun detrás de otras piezas.
          <group position={[0, -alto * 0.45, profundidad * 0.5 + 0.28]} raycast={() => null}>
            {[Math.PI / 4, -Math.PI / 4].map((giro) => (
              <mesh key={giro} rotation={[0, 0, giro]} renderOrder={10} raycast={() => null}>
                <boxGeometry args={[0.7 * factor, 0.09, 0.05]} />
                <meshBasicMaterial color={COLORES.EXTRACCION} depthTest={false} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )}
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
