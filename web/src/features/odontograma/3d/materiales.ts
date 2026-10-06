import { Color, MeshPhysicalMaterial } from "three";

export const COLORES = {
  ORO: "#d6a62a",
  PROTESIS: "#aebbc8",
  FANTASMA: "#9aa3ad",
  SELECCION: "#2fb5ae",
  EXTRACCION: "#e53935",
  ENDODONCIA: "#d4506a",
} as const;

export type Emisivo = "ninguno" | "hover" | "seleccion" | "extraccion";

const EMISIVOS: Record<Emisivo, readonly [string, number]> = {
  ninguno: ["#000000", 0],
  hover: ["#2a3640", 0.5],
  seleccion: ["#1f5f74", 0.55],
  extraccion: ["#ff2d2d", 0.18],
};

// Los materiales se comparten entre las 32 piezas: hay pocas combinaciones distintas y no se liberan.
const cache = new Map<string, MeshPhysicalMaterial>();

function cacheado(clave: string, crear: () => MeshPhysicalMaterial): MeshPhysicalMaterial {
  let m = cache.get(clave);
  if (!m) {
    m = crear();
    cache.set(clave, m);
  }
  return m;
}

function aplicarEmisivo(m: MeshPhysicalMaterial, emisivo: Emisivo): void {
  const [color, intensidad] = EMISIVOS[emisivo];
  m.emissive = new Color(color);
  m.emissiveIntensity = intensidad;
}

export type TipoMaterialCorona = "esmalte" | "oro" | "protesis" | "fantasma";

export interface OpcionesCorona {
  material: TipoMaterialCorona;
  /** Color clínico de la superficie (caries, obturación...) o `null` para el esmalte natural. */
  color: string | null;
  emisivo: Emisivo;
}

/** Material de una cara de la corona. El esmalte multiplica su color por el degradado de los vértices. */
export function materialCorona({ material, color, emisivo }: OpcionesCorona): MeshPhysicalMaterial {
  const tinte = material === "esmalte" ? (color ?? "#ffffff") : "";
  return cacheado(`corona|${material}|${tinte}|${emisivo}`, () => {
    let m: MeshPhysicalMaterial;
    switch (material) {
      case "esmalte":
        m = new MeshPhysicalMaterial({
          color: tinte,
          vertexColors: true,
          roughness: 0.26,
          metalness: 0,
          clearcoat: 0.75,
          clearcoatRoughness: 0.18,
          reflectivity: 0.5,
        });
        break;
      case "oro":
        m = new MeshPhysicalMaterial({
          color: COLORES.ORO,
          metalness: 0.92,
          roughness: 0.22,
          envMapIntensity: 1.3,
        });
        break;
      case "protesis":
        m = new MeshPhysicalMaterial({
          color: COLORES.PROTESIS,
          metalness: 0.55,
          roughness: 0.3,
          clearcoat: 0.4,
          clearcoatRoughness: 0.25,
        });
        break;
      case "fantasma":
        m = new MeshPhysicalMaterial({
          color: COLORES.FANTASMA,
          roughness: 0.5,
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
        });
        break;
    }
    aplicarEmisivo(m, emisivo);
    return m;
  });
}

/** Encía: rosada y húmeda; el color por vértice marca el borde más claro y la base más oscura. */
export function materialEncia(): MeshPhysicalMaterial {
  return cacheado(
    "encia",
    () =>
      new MeshPhysicalMaterial({
        color: "#ffffff",
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.55,
        clearcoatRoughness: 0.35,
      }),
  );
}
