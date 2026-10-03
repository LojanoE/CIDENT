import { initializeApp } from "firebase-admin/app";

// Inicialización única del Admin SDK. Cada función importa `firebase-admin/*`
// directamente (getAuth(), getFirestore(), etc.) en vez de reexportar
// instancias desde aquí, para mantener el cold-start de cada función acotado
// a lo que realmente usa.
initializeApp();

export { login } from "./auth/login.js";
export { crearUsuario } from "./auth/crearUsuario.js";
export { cambiarPassword } from "./auth/cambiarPassword.js";
export { actualizarUsuario } from "./auth/actualizarUsuario.js";

export { actualizarCentro } from "./admin/actualizarCentro.js";

export { eliminarAtencion } from "./atenciones/eliminarAtencion.js";
export { anularAtencion } from "./atenciones/anularAtencion.js";

export { generarReceta } from "./documentos/generarReceta.js";
export { generarCertificado } from "./documentos/generarCertificado.js";
export { generarPresupuesto } from "./documentos/generarPresupuesto.js";
export { registrarPago } from "./pagos/registrarPago.js";
export { anularPago } from "./pagos/anularPago.js";
export { registrarGasto } from "./pagos/registrarGasto.js";
export { anularGasto } from "./pagos/anularGasto.js";
export { generarResumenAtencion } from "./documentos/generarResumenAtencion.js";

export { onAdjuntoSubido } from "./storage/onAdjuntoSubido.js";
export { crearEnlacePortal } from "./portal/crearEnlacePortal.js";
export { revocarEnlacePortal } from "./portal/revocarEnlacePortal.js";
export { verPortalPaciente } from "./portal/verPortalPaciente.js";
