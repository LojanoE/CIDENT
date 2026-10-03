import type { Odontograma as OdontogramaData, TipoOdontograma, Zona } from "@cident/shared";
import { FDI_PERMANENTES, FDI_TEMPORALES, arcadaDe } from "@cident/shared";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cn } from "../../../lib/cn";
import type { SeleccionOdontograma } from "../Odontograma";
import { Diente3D } from "./Diente3D";

type Vista = "frente" | "superior" | "inferior";

const VISTAS: Array<{ id: Vista; etiqueta: string }> = [
  { id: "frente", etiqueta: "Frente" },
  { id: "superior", etiqueta: "Superior" },
  { id: "inferior", etiqueta: "Inferior" },
];

const POSICION_CAMARA: Record<Vista, [number, number, number]> = {
  frente: [0, 0.6, 12.5],
  superior: [0, -12, 3],
  inferior: [0, 12, 3],
};
const OBJETIVO: [number, number, number] = [0, 0, 0.5];
const APERTURA = 1.6;

interface Odontograma3DProps {
  tipo: TipoOdontograma;
  dientes: OdontogramaData;
  soloLectura: boolean;
  seleccion: SeleccionOdontograma | null;
  onZonaClick: (fdi: number, zona: Zona) => void;
  onGeneralClick: (fdi: number) => void;
}

/** Desplaza la arcada en Y hacia `destino` con una animación suave (render bajo demanda). */
function Deslizable({ destino, children }: { destino: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
  }, [destino, invalidate]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const falta = destino - g.position.y;
    if (Math.abs(falta) < 0.002) {
      g.position.y = destino;
      return;
    }
    g.position.y += falta * Math.min(1, delta * 8);
    invalidate();
  });

  return <group ref={ref}>{children}</group>;
}

function Camara({ vista, controles }: { vista: Vista; controles: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const [x, y, z] = POSICION_CAMARA[vista];
    camera.position.set(x, y, z);
    controles.current?.target.set(...OBJETIVO);
    controles.current?.update();
    invalidate();
  }, [vista, camera, controles, invalidate]);

  return null;
}

export function Odontograma3D({
  tipo,
  dientes,
  soloLectura,
  seleccion,
  onZonaClick,
  onGeneralClick,
}: Odontograma3DProps) {
  const [vista, setVista] = useState<Vista>("frente");
  const [abierta, setAbierta] = useState(false);
  const controles = useRef<OrbitControlsImpl | null>(null);

  const lista = tipo === "adulto" ? FDI_PERMANENTES : FDI_TEMPORALES;
  const superiores = lista.filter((fdi) => arcadaDe(fdi) === "superior");
  const inferiores = lista.filter((fdi) => arcadaDe(fdi) === "inferior");

  function renderDiente(fdi: number) {
    return (
      <Diente3D
        key={fdi}
        fdi={fdi}
        estado={dientes[String(fdi)]}
        soloLectura={soloLectura}
        seleccionada={seleccion?.fdi === fdi ? seleccion.zona : null}
        generalSeleccionado={seleccion?.fdi === fdi && seleccion.zona === null}
        onZonaClick={onZonaClick}
        onGeneralClick={onGeneralClick}
      />
    );
  }

  const boton = (activo: boolean) =>
    cn(
      "min-h-touch rounded-md px-3 text-sm font-medium backdrop-blur",
      activo ? "bg-accent text-accent-ink" : "bg-surface/90 text-ink hover:bg-accent-wash",
    );

  return (
    <div className="space-y-2">
      <div
        className="relative h-[420px] w-full overflow-hidden rounded-lg border border-line bg-gradient-to-b from-accent-wash to-surface sm:h-[520px]"
        role="group"
        aria-label={`Boca 3D, dentición ${tipo === "adulto" ? "adulto" : "infantil"}`}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: POSICION_CAMARA.frente, fov: 35, near: 0.1, far: 100 }}
        >
          <ambientLight intensity={0.55} />
          <hemisphereLight args={["#ffffff", "#c9b9a0", 0.5]} />
          <directionalLight position={[4, 8, 10]} intensity={1.6} />
          <directionalLight position={[-6, -4, 6]} intensity={0.5} />

          <Deslizable destino={abierta ? APERTURA : 0}>{superiores.map(renderDiente)}</Deslizable>
          <Deslizable destino={abierta ? -APERTURA : 0}>{inferiores.map(renderDiente)}</Deslizable>

          <OrbitControls
            ref={controles}
            makeDefault
            target={OBJETIVO}
            enablePan={false}
            minDistance={5}
            maxDistance={20}
            enableDamping={false}
          />
          <Camara vista={vista} controles={controles} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex gap-1">
            {VISTAS.map(({ id, etiqueta }) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => setVista(id)}
                className={boton(vista === id)}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={abierta}
            onClick={() => setAbierta((v) => !v)}
            className={cn("pointer-events-auto", boton(abierta))}
          >
            Abrir boca
          </button>
        </div>
      </div>
      <p className="text-13 text-ink-soft">
        Arrastra para girar · pellizca o usa la rueda para acercar · toca una cara del diente
        {soloLectura ? " para ver su detalle." : " para editarla; doble toque para el diente completo."}
      </p>
    </div>
  );
}
