import type { Odontograma as OdontogramaData, TipoOdontograma, Zona } from "@cident/shared";
import { FDI_PERMANENTES, FDI_TEMPORALES, arcadaDe } from "@cident/shared";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Box3, Vector3 } from "three";
import type { Group, Mesh, PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cn } from "../../../lib/cn";
import type { SeleccionOdontograma } from "../Odontograma";
import { Diente3D } from "./Diente3D";
import { Encia3D } from "./Encia3D";
import { calidadAlta } from "./calidad";

type Vista = "frente" | "superior" | "inferior";

const VISTAS: Array<{ id: Vista; etiqueta: string }> = [
  { id: "frente", etiqueta: "Frente" },
  { id: "superior", etiqueta: "Superior" },
  { id: "inferior", etiqueta: "Inferior" },
];

/** Dirección desde el centro de la boca hacia la cámara en cada vista. */
const DIRECCION_CAMARA: Record<Vista, [number, number, number]> = {
  frente: [0, 0.15, 1],
  superior: [0, -1, 0.25],
  inferior: [0, 1, 0.25],
};
const MARGEN_ENCUADRE = 1.15;
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

/** Encuadra la boca completa (ancho y alto) según el tamaño del canvas y la vista elegida. */
function Camara({
  vista,
  controles,
  boca,
}: {
  vista: Vista;
  controles: React.RefObject<OrbitControlsImpl | null>;
  boca: React.RefObject<Group | null>;
}) {
  const { camera, invalidate, size } = useThree();
  const medida = useRef<{ centro: Vector3; ancho: number; alto: number; fondo: number } | null>(null);

  useEffect(() => {
    if (!medida.current && boca.current) {
      // Se mide una sola vez, con las arcadas aún cerradas; la apertura se suma aparte.
      // Solo los dientes: la encía (marcada con `userData.encia`) no debe agrandar el encuadre.
      const caja = new Box3();
      boca.current.updateWorldMatrix(true, true);
      boca.current.traverse((obj) => {
        if (obj.userData.encia || !(obj as Mesh).isMesh || obj.parent?.userData.encia) return;
        caja.expandByObject(obj, false);
      });
      if (!caja.isEmpty()) {
        const t = caja.getSize(new Vector3());
        medida.current = { centro: caja.getCenter(new Vector3()), ancho: t.x, alto: t.y + 2 * APERTURA, fondo: t.z };
      }
    }
    const m = medida.current ?? { centro: new Vector3(0, 0, 0.5), ancho: 12, alto: 8.5, fondo: 5 };
    const cam = camera as PerspectiveCamera;
    const tanMitad = Math.tan((cam.fov * Math.PI) / 360);
    const aspecto = size.width / Math.max(size.height, 1);
    // En las vistas superior/inferior el alto visible es la profundidad de la boca.
    const altoVisible = vista === "frente" ? m.alto : m.fondo + 2 * APERTURA * 0.25;
    const distancia =
      Math.max(altoVisible / 2 / tanMitad, m.ancho / 2 / (tanMitad * aspecto)) * MARGEN_ENCUADRE + m.fondo / 2;

    const dir = new Vector3(...DIRECCION_CAMARA[vista]).normalize();
    camera.position.copy(m.centro).addScaledVector(dir, distancia);
    const c = controles.current;
    if (c) {
      c.target.copy(m.centro);
      c.maxDistance = distancia * 1.8;
      c.update();
    }
    invalidate();
  }, [vista, camera, controles, boca, size.width, size.height, invalidate]);

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
  const [abierta, setAbierta] = useState(true);
  const [encia, setEncia] = useState(true);
  const [alta] = useState(calidadAlta);
  const controles = useRef<OrbitControlsImpl | null>(null);
  const boca = useRef<Group>(null);

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
        encia={encia}
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
          dpr={alta ? [1, 2] : [1, 1.5]}
          shadows={alta ? "percentage" : false}
          gl={{ antialias: !alta }}
          camera={{ position: [0, 2, 14], fov: 35, near: 0.1, far: 100 }}
        >
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[4, 8, 10]}
            intensity={1.5}
            castShadow={alta}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-camera-left={-9}
            shadow-camera-right={9}
            shadow-camera-top={9}
            shadow-camera-bottom={-9}
          />
          <directionalLight position={[-6, -4, 6]} intensity={0.35} />

          {/* Entorno de estudio armado con paneles locales: sin descargas, funciona sin conexión. */}
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 5, 5]} rotation={[-Math.PI / 3, 0, 0]} scale={[10, 4, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#fff3e0" position={[-6, 1, 3]} rotation={[0, Math.PI / 2.5, 0]} scale={[6, 4, 1]} />
            <Lightformer form="rect" intensity={1.2} color="#e6f0ff" position={[6, 1, 3]} rotation={[0, -Math.PI / 2.5, 0]} scale={[6, 4, 1]} />
            <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, -3, 6]} scale={4} />
          </Environment>

          <group ref={boca}>
            <Deslizable destino={abierta ? APERTURA : 0}>
              {encia && <Encia3D superior temporal={tipo !== "adulto"} />}
              {superiores.map(renderDiente)}
            </Deslizable>
            <Deslizable destino={abierta ? -APERTURA : 0}>
              {encia && <Encia3D superior={false} temporal={tipo !== "adulto"} />}
              {inferiores.map(renderDiente)}
            </Deslizable>
          </group>

          {alta && (
            <EffectComposer multisampling={0}>
              <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={1} quality="medium" />
              <SMAA />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          )}

          <OrbitControls
            ref={controles}
            makeDefault
            enablePan={false}
            minDistance={5}
            maxDistance={30}
            enableDamping={false}
          />
          <Camara vista={vista} controles={controles} boca={boca} />
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
          <div className="pointer-events-auto flex gap-1">
            <button type="button" aria-pressed={encia} onClick={() => setEncia((v) => !v)} className={boton(encia)}>
              Encía
            </button>
            <button
              type="button"
              aria-pressed={abierta}
              onClick={() => setAbierta((v) => !v)}
              className={boton(abierta)}
            >
              {abierta ? "Cerrar boca" : "Abrir boca"}
            </button>
          </div>
        </div>
      </div>
      <p className="text-13 text-ink-soft">
        Arrastra para girar · pellizca o usa la rueda para acercar · toca una cara del diente
        {soloLectura ? " para ver su detalle." : " para editarla; doble toque para el diente completo."}
      </p>
    </div>
  );
}
