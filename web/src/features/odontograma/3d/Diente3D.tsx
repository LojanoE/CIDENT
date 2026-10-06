import type { EstadoDiente, Zona } from "@cident/shared";
import { apariencia, arcadaDe } from "@cident/shared";
import { Html, Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useState } from "react";
import { colocacion } from "./arcada";
import { geometriaDiente } from "./geometrias";
import type { Emisivo, TipoMaterialCorona } from "./materiales";
import { COLORES, materialCorona } from "./materiales";

/** Por debajo de este desplazamiento (px) un clic cuenta como toque y no como arrastre de la cámara. */
const UMBRAL_ARRASTRE = 6;
/** Tinte de la raíz de un diente con endodoncia (se ve con la encía apagada). */
const TINTE_ENDODONCIA = "#f0a8b4";

function esBlanco(color: string | null): boolean {
  return color === null || color.toLowerCase() === "#ffffff";
}

/** Zona clínica de cada grupo de la malla (null = raíz, que cuenta como diente completo). */
const ZONAS_POR_GRUPO: ReadonlyArray<Zona | null> = [null, "oclusal", "vestibular", "lingual", "mesial", "distal"];

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

  const col = useMemo(() => colocacion(fdi), [fdi]);
  const geo = useMemo(() => geometriaDiente(fdi, col.mesialDir), [fdi, col.mesialDir]);
  const ap = useMemo(() => apariencia(estado), [estado]);
  const invertido = arcadaDe(fdi) === "superior";
  const factor = fdi >= 50 ? 0.85 : 1;
  const verRaices = !ap.ausente && !encia;

  const materiales = useMemo(
    () =>
      ZONAS_POR_GRUPO.map((zona) => {
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

        let color = zona !== null && !esBlanco(propio) ? propio : null;
        if (zona === null && ap.endodoncia && verRaices) color = TINTE_ENDODONCIA;

        return materialCorona({ material, color, emisivo });
      }),
    [ap, seleccionada, generalSeleccionado, hover, verRaices],
  );

  /** Región de la malla tocada; la raíz no se toca con la encía puesta (está tapada). */
  function regionDe(e: ThreeEvent<MouseEvent | PointerEvent>): number | null {
    const r = e.face?.materialIndex ?? 0;
    return r === 0 && encia ? null : r;
  }

  function alPulsar(e: ThreeEvent<MouseEvent>) {
    const r = regionDe(e);
    if (r === null) return;
    e.stopPropagation();
    if (e.delta > UMBRAL_ARRASTRE) return;
    const zona = ZONAS_POR_GRUPO[r] ?? null;
    if (zona) onZonaClick(fdi, zona);
    else if (!soloLectura) onGeneralClick(fdi);
  }

  function alDobleClic(e: ThreeEvent<MouseEvent>) {
    if (regionDe(e) === null) return;
    e.stopPropagation();
    if (!soloLectura) onGeneralClick(fdi);
  }

  function entrar(e: ThreeEvent<PointerEvent>) {
    if (regionDe(e) === null) return;
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
    <group position={[col.x, col.y, col.z]} rotation={[0, col.rotY, 0]}>
      {/* Marco local: oclusal en y=0, corona hacia -y; la arcada superior se espeja en y. */}
      <group scale={[1, invertido ? -1 : 1, 1]}>
        {/* Los anteriores se inclinan hacia vestibular pivotando en el cuello. */}
        <group position={[0, -geo.tope, 0]} rotation={[col.inclinacion, 0, 0]}>
          <group position={[0, geo.tope, 0]}>
            <mesh
              geometry={geo.geometry}
              material={materiales}
              onClick={alPulsar}
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

            {ap.endodoncia && !ap.ausente && (
              // Punto de acceso a la cámara pulpar, embutido en el centro de la cara oclusal.
              <mesh position={[0, -0.015, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.13 * factor, 0.13 * factor, 0.05, 16]} />
                <meshStandardMaterial color={COLORES.ENDODONCIA} roughness={0.4} />
              </mesh>
            )}

            {ap.extraccionIndicada && !ap.ausente && (
              // «X» roja que flota delante de la cara vestibular, visible aun detrás de otras piezas.
              <group position={[0, -geo.tope / 2, col.spec.D * 0.05 + 0.28]} raycast={() => null}>
                {[Math.PI / 4, -Math.PI / 4].map((giro) => (
                  <mesh key={giro} rotation={[0, 0, giro]} renderOrder={10} raycast={() => null}>
                    <boxGeometry args={[0.7 * factor, 0.09, 0.05]} />
                    <meshBasicMaterial color={COLORES.EXTRACCION} depthTest={false} toneMapped={false} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        </group>
      </group>
      {mostrarEtiqueta && (
        <Html position={[0, invertido ? 0.9 : -0.9, 0.9]} center zIndexRange={[10, 0]}>
          <span className="pointer-events-none select-none rounded bg-ink px-1.5 py-0.5 font-mono text-xs text-white shadow">
            {fdi}
          </span>
        </Html>
      )}
    </group>
  );
}

export const Diente3D = memo(Diente3DBase);
