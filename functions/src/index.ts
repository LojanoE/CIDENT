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
export { generarResumenAtencion } from "./documentos/generarResumenAtencion.js";

export { onAdjuntoSubido } from "./storage/onAdjuntoSubido.js";
