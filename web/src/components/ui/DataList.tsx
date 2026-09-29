import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useEsEscritorio } from "../../lib/useMediaQuery";

export interface Columna<T> {
  id: string;
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
  /** Alineación de la celda en la tabla (por defecto, izquierda). */
  align?: "right";
}

export interface DataListProps<T> {
  items: T[];
  columns: Columna<T>[];
  rowKey: (item: T) => string;
  /** Si se define, la fila (tabla) o la tarjeta (móvil) completa navega a esa ruta. */
  rowHref?: (item: T) => string;
  /** Presentación en móvil; por defecto, la primera columna como título y el resto como pares etiqueta/valor. */
  renderCard?: (item: T) => ReactNode;
  caption: string;
  className?: string;
}

/** Una sola fuente de datos, dos presentaciones: tabla desde md, tarjetas por debajo. Solo se monta una. */
export function DataList<T>({ items, columns, rowKey, rowHref, renderCard, caption, className }: DataListProps<T>) {
  const escritorio = useEsEscritorio();

  if (!escritorio) {
    return (
      <ul aria-label={caption} className={cn("space-y-2", className)}>
        {items.map((item) => {
          const contenido = renderCard ? renderCard(item) : <TarjetaPorDefecto item={item} columns={columns} />;
          return (
            <li key={rowKey(item)}>
              {rowHref ? (
                <Link
                  to={rowHref(item)}
                  className="block rounded-lg border border-line bg-surface p-4 shadow-card active:bg-accent-wash"
                >
                  {contenido}
                </Link>
              ) : (
                <div className="rounded-lg border border-line bg-surface p-4 shadow-card">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface shadow-card", className)}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn("px-4 py-2.5 font-medium", c.align === "right" && "text-right", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={rowKey(item)} className="relative border-b border-line last:border-0 hover:bg-accent-wash">
              {columns.map((c, i) => (
                <td key={c.id} className={cn("px-4 py-3", c.align === "right" && "text-right", c.className)}>
                  {rowHref && i === 0 ? (
                    // Enlace estirado: toda la fila es clickeable sin anidar interactivos.
                    <Link to={rowHref(item)} className="font-medium after:absolute after:inset-0">
                      {c.cell(item)}
                    </Link>
                  ) : (
                    c.cell(item)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TarjetaPorDefecto<T>({ item, columns }: { item: T; columns: Columna<T>[] }) {
  const [titulo, ...resto] = columns;
  return (
    <div className="space-y-2">
      <div className="font-medium">{titulo.cell(item)}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-13">
        {resto.map((c) => (
          <div key={c.id} className="contents">
            <dt className="text-ink-soft">{c.header}</dt>
            <dd className="text-right">{c.cell(item)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
