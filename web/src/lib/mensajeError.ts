export function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado.";
}
