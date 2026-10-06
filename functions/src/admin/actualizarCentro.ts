import { actualizarCentroSchema, type Centro, type LogoCentro } from "@cident/shared";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { requireAdmin } from "../lib/guards.js";
import { validarImagenLogo } from "../lib/imagen.js";

/**
 * Edición de los datos de un centro (incluido su logo) desde el panel de admin.
 *
 * `centros/{centroId}` es de solo lectura para los clientes en `firestore.rules`,
 * y `centros/**` en Storage tiene `write: if false`: ambas escrituras pasan
 * obligatoriamente por aquí, con el Admin SDK.
 *
 * El logo viaja en base64 dentro del payload en vez de subirse a una ruta de
 * staging: un logo pesa mucho menos que el límite de una llamada callable, y así
 * no hace falta ni un trigger de Storage nuevo ni relajar las reglas de subida
 * (que hoy atan cada subida al centro del propio usuario, así que un admin no
 * podría subir el logo de otro centro).
 */

function rutaLogo(centroId: string, extension: string): string {
  return `centros/${centroId}/branding/logo.${extension}`;
}

export const actualizarCentro = onCall({ region: "southamerica-east1" }, async (request) => {
  const contexto = requireAdmin(request);

  const parsed = actualizarCentroSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const { centroId, nombre, direccion, telefono, piePdf, plantillaRecordatorio, logo, quitarLogo } = parsed.data;

  const db = getFirestore();
  const centroRef = db.collection("centros").doc(centroId);
  const centroSnap = await centroRef.get();
  if (!centroSnap.exists) {
    throw new HttpsError("not-found", "Centro no encontrado.");
  }
  const logoActual = (centroSnap.data() as Centro).logo ?? null;

  const bucket = getStorage().bucket();
  const borrarLogoActual = async () => {
    if (!logoActual?.storagePath) return;
    await bucket.file(logoActual.storagePath).delete().catch(() => undefined);
  };

  const actualizacion: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (nombre !== undefined) actualizacion.nombre = nombre;
  if (direccion !== undefined) actualizacion.direccion = direccion;
  if (telefono !== undefined) actualizacion.telefono = telefono;
  if (piePdf !== undefined) actualizacion.piePdf = piePdf;
  if (plantillaRecordatorio !== undefined) actualizacion.plantillaRecordatorio = plantillaRecordatorio;

  let logoCambiado: "subido" | "quitado" | null = null;

  if (logo !== undefined) {
    const buffer = Buffer.from(logo.base64, "base64");
    const validacion = validarImagenLogo(buffer, logo.mimeType);
    if (!validacion.ok) {
      throw new HttpsError("invalid-argument", validacion.motivo);
    }

    const storagePath = rutaLogo(centroId, validacion.extension);
    await bucket.file(storagePath).save(buffer, { contentType: validacion.mimeType });

    // Un PNG puede reemplazar a un JPEG: el archivo anterior quedaría huérfano.
    if (logoActual?.storagePath && logoActual.storagePath !== storagePath) {
      await borrarLogoActual();
    }

    const nuevoLogo: LogoCentro = {
      storagePath,
      mimeType: validacion.mimeType,
      actualizadoEn: new Date().toISOString(),
    };
    actualizacion.logo = nuevoLogo;
    logoCambiado = "subido";
  } else if (quitarLogo === true) {
    await borrarLogoActual();
    actualizacion.logo = null;
    logoCambiado = "quitado";
  }

  await centroRef.update(actualizacion);

  await registrarAuditoria({
    accion: "centro_actualizado",
    uid: contexto.uid,
    centroId: contexto.claims.centroId,
    entidad: { tipo: "centros", id: centroId },
    detalle: {
      campos: Object.keys(actualizacion).filter((c) => c !== "updatedAt"),
      logoCambiado,
    },
  });

  return { ok: true };
});
