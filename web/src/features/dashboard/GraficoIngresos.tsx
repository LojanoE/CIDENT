import { dinero } from "../pagos/pagosApi";

/** Barras CSS de ingresos por día, desde el día 1 del mes hasta hoy (los días sin cobros valen 0). */
export function GraficoIngresos({ hoy, porDia }: { hoy: string; porDia: { fecha: string; monto: number }[] }) {
  const mapa = new Map(porDia.map((d) => [d.fecha, d.monto]));
  const ultimoDia = Number(hoy.slice(8, 10));
  const dias = Array.from({ length: ultimoDia }, (_, i) => {
    const fecha = `${hoy.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    return { fecha, dia: i + 1, monto: mapa.get(fecha) ?? 0 };
  });
  const maximo = Math.max(...dias.map((d) => d.monto), 0);

  if (maximo === 0) {
    return <p className="py-6 text-center text-sm text-ink-soft">Aún no hay cobros este mes.</p>;
  }

  return (
    <div>
      <ul className="flex h-32 items-end gap-0.5" aria-label="Ingresos por día del mes">
        {dias.map((d) => (
          <li
            key={d.fecha}
            title={`${d.fecha}: ${dinero(d.monto)}`}
            aria-label={`${d.fecha}: ${dinero(d.monto)}`}
            className="flex h-full flex-1 items-end"
          >
            <div
              className={d.monto > 0 ? "w-full rounded-t-sm bg-accent" : "w-full rounded-t-sm bg-line"}
              style={{ height: d.monto > 0 ? `${Math.max(4, (d.monto / maximo) * 100)}%` : "2px" }}
            />
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-13 text-ink-soft">
        <span>1</span>
        <span>Máx. {dinero(maximo)}</span>
        <span>{ultimoDia}</span>
      </div>
    </div>
  );
}
