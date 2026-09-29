import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

export interface SearchInputProps {
  /** Se invoca con el texto ya estabilizado (sin disparar por cada tecla). */
  onSearch: (texto: string) => void;
  label: string;
  placeholder?: string;
  delayMs?: number;
  className?: string;
}

export function SearchInput({ onSearch, label, placeholder, delayMs = 250, className }: SearchInputProps) {
  const [texto, setTexto] = useState("");
  const alBuscar = useRef(onSearch);

  useEffect(() => {
    alBuscar.current = onSearch;
  });

  useEffect(() => {
    const t = window.setTimeout(() => alBuscar.current(texto), delayMs);
    return () => window.clearTimeout(t);
  }, [texto, delayMs]);

  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="block min-h-touch w-full rounded-md border border-input bg-surface pl-9 pr-11 text-base placeholder:text-ink-soft md:min-h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {texto && (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => setTexto("")}
          className="absolute right-0 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center text-ink-soft hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
