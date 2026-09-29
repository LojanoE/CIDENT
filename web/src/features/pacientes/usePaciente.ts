import type { Paciente } from "@cident/shared";
import { useOutletContext } from "react-router-dom";

/** Lo que `PacienteLayout` comparte con sus rutas hijas. */
export interface ContextoPaciente {
  paciente: Paciente;
  /** Aplica en memoria los cambios ya persistidos, para que la barra de contexto los refleje. */
  alActualizar: (cambios: Partial<Paciente>) => void;
}

export function usePaciente(): ContextoPaciente {
  return useOutletContext<ContextoPaciente>();
}
