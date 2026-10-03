import { useEffect, useState } from "react";
import { Button, Dialog, Field, Textarea, useToast } from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";

/** Anular nunca borra: pide un motivo (mínimo 5 caracteres) que queda en el movimiento y en la auditoría. */
export function AnularMovimientoDialog({
  open,
  titulo,
  descripcion,
  onClose,
  onConfirmar,
}: {
  open: boolean;
  titulo: string;
  descripcion: string;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const invalido = motivo.trim().length < 5;

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
      onClose();
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titulo}
      description={descripcion}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmar} loading={enviando} disabled={invalido}>
            Anular
          </Button>
        </>
      }
    >
      <Field label="Motivo" required hint="Mínimo 5 caracteres.">
        <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
    </Dialog>
  );
}
