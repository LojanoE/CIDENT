import { buscarCie10, textoCie10 } from "@cident/shared";
import { Search, X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "../../components/ui";
import { cn } from "../../lib/cn";

interface Cie10CampoProps {
  /** Diagnósticos elegidos («K02.1 Caries de la dentina»). */
  value: string[];
  onChange: (valor: string[]) => void;
}

/**
 * Buscador de diagnósticos CIE-10: se escribe el código («K02») o palabras
 * («caries dentina») y se elige de la lista; se pueden agregar varios y quitar
 * con la X. Si no está en el catálogo, la última opción deja usar lo escrito tal cual.
 */
export function Cie10Campo({ value, onChange }: Cie10CampoProps) {
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const resultados = useMemo(
    () => buscarCie10(texto, 8).filter((r) => !value.includes(textoCie10(r))),
    [texto, value],
  );
  const escrito = texto.trim();
  const opciones = useMemo(() => {
    const lista = resultados.map((r) => ({ clave: r.codigo, etiqueta: textoCie10(r), valor: textoCie10(r), libre: false }));
    const yaElegido = value.some((v) => v.toLowerCase() === escrito.toLowerCase());
    if (escrito && !yaElegido && !lista.some((o) => o.valor.toLowerCase() === escrito.toLowerCase())) {
      lista.push({ clave: "__libre__", etiqueta: `Usar «${escrito}» tal cual`, valor: escrito, libre: true });
    }
    return lista;
  }, [resultados, escrito, value]);

  const elegir = (valor: string) => {
    onChange([...value, valor]);
    setTexto("");
    setAbierto(false);
    setActivo(0);
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => Math.min(i + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && abierto && opciones[activo]) {
      e.preventDefault(); // no enviar el formulario del certificado
      elegir(opciones[activo].valor);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const chips = value.length > 0 && (
    <ul className="mb-2 flex flex-wrap gap-2">
      {value.map((v) => (
        <li
          key={v}
          className="flex items-center gap-1 rounded-md border border-input bg-accent-wash py-1 pl-3 pr-1 text-sm"
        >
          <span className="min-w-0 break-words">{v}</span>
          <button
            type="button"
            aria-label={`Quitar ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded text-ink-soft hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      {chips}
      <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <Input
        role="combobox"
        aria-expanded={abierto && opciones.length > 0}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && opciones[activo] ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        className="pl-9"
        placeholder="Buscar por código o nombre: K02, caries, pulpitis…"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={alTeclear}
      />
      {abierto && opciones.length > 0 && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {opciones.map((o, i) => (
            <li
              key={o.clave}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              // mousedown (y no click) para elegir antes de que el input pierda el foco y cierre la lista.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o.valor);
              }}
              onMouseEnter={() => setActivo(i)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                i === activo ? "bg-accent-wash text-ink" : "text-ink",
                o.libre && "italic text-ink-soft",
              )}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
