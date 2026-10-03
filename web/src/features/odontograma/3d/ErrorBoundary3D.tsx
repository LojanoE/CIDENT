import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Se muestra si falla la carga del módulo 3D (p. ej. sin conexión en la primera visita). */
  alternativa: ReactNode;
}

export class ErrorBoundary3D extends Component<Props, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    return this.state.fallo ? this.props.alternativa : this.props.children;
  }
}
