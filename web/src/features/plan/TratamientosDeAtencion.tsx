import type { ItemPlan } from "@cident/shared";
import { Check, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, CardBody, CardHeader, Input, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { desmarcar, marcarRealizado } from "./planApi";
import { usePlan } from "./usePlan";

interface Props {
  patientId: string;
  centroId: string;
  visitId: string;
  fecha: string;
  uid: string;
  soloLectura: boolean;
}

/** Plan del paciente dentro de la atención: marcar lo realizado hoy y ver lo ya hecho en esta visita. */
export function TratamientosDeAtencion({ patientId, centroId, visitId, fecha, uid, soloLectura }: Props) {
  const { items, error } = usePlan(patientId, centroId);
  const toast = useToast();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (!items) return null;

  const pendientes = items.filter((i) => i.estado === "pendiente");
  const deEstaVisita = items.filter((i) => i.estado === "realizado" && i.realizado?.visitId === visitId);

  async function ejecutar(item: ItemPlan, accion: () => Promise<void>) {
    setOcupado(item.id);
    try {
      await accion();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  const nombre = (i: ItemPlan) => (i.pieza ? `${i.tratamiento} · pieza ${i.pieza}` : i.tratamiento);

  return (
    <Card>
      <CardHeader title="Tratamientos de esta atención" />
      <CardBody className="space-y-3">
        {pendientes.length === 0 && deEstaVisita.length === 0 && (
          <p className="text-sm text-ink-soft">
            No hay tratamientos pendientes. Arma el plan en la pestaña{" "}
            <Link to={`/pacientes/${patientId}/plan`} className="underline">
              Plan
            </Link>{" "}
            del paciente.
          </p>
        )}

        {deEstaVisita.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="ok">Realizado hoy</Badge>
            <span className="font-medium">{nombre(i)}</span>
            {i.realizado?.nota && <span className="text-ink-soft">— {i.realizado.nota}</span>}
            {!soloLectura && (
              <Button
                size="sm"
                variant="ghost"
                loading={ocupado === i.id}
                onClick={() => void ejecutar(i, () => desmarcar(patientId, i.id))}
              >
                <Undo2 aria-hidden className="h-4 w-4" /> Deshacer
              </Button>
            )}
          </div>
        ))}

        {pendientes.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{nombre(i)}</span>
            <Input
              aria-label={`Nota para ${nombre(i)}`}
              placeholder="Nota (opcional)"
              maxLength={200}
              disabled={soloLectura}
              className="w-full sm:w-56"
              value={notas[i.id] ?? ""}
              onChange={(e) => setNotas((n) => ({ ...n, [i.id]: e.target.value }))}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={soloLectura}
              loading={ocupado === i.id}
              onClick={() =>
                void ejecutar(i, () => marcarRealizado(patientId, i.id, visitId, fecha, uid, (notas[i.id] ?? "").trim()))
              }
            >
              <Check aria-hidden className="h-4 w-4" /> Realizado hoy
            </Button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
