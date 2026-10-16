import {
  FIRMA_MANUSCRITA_MAX_BASE64,
  guardarCertificadoFirmaSchema,
  guardarFirmaManuscritaSchema,
  type CertificadoFirma,
} from "@cident/shared";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { registrarAuditoria } from "../lib/auditoria.js";
import { cifrar, FIRMA_KEK } from "../lib/cifrado.js";
import { requireAuth } from "../lib/guards.js";
import { limpiarFallosFirma, verificarLimiteFirma } from "../lib/rateLimit.js";
import { descargarOpcional, rutaCertificado, rutaManuscrita } from "../pdf/firma.js";
import { abrirP12, verificarVigencia } from "./prepararFirma.js";

const REGION = { region: "southamerica-east1" } as const;
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Todo actúa solo sobre el `uid` de quien llama: nadie gestiona la firma de otro. */

export const guardarCertificadoFirma = onCall({ ...REGION, secrets: [FIRMA_KEK] }, async (request) => {
  const { uid, claims } = requireAuth(request);

  const parsed = guardarCertificadoFirmaSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  const { p12Base64, password } = parsed.data;

  await verificarLimiteFirma(uid);
  const p12 = Buffer.from(p12Base64, "base64");
  const datos = await abrirP12(p12, password, uid);
  verificarVigencia(datos);

  await getStorage().bucket().file(rutaCertificado(uid)).save(cifrar(p12, FIRMA_KEK.value(), uid), {
    contentType: "application/octet-stream",
  });

  const resumen: CertificadoFirma = {
    titular: datos.titular,
    emisor: datos.emisor,
    validoHasta: datos.validoHasta,
    subidoAt: new Date().toISOString(),
  };
  await getFirestore().collection("users").doc(uid).update({ firmaElectronica: resumen });
  await limpiarFallosFirma(uid);

  await registrarAuditoria({
    accion: "firma_certificado_guardado",
    uid,
    centroId: claims.centroId,
    entidad: { tipo: "users", id: uid },
    detalle: { titular: datos.titular, validoHasta: datos.validoHasta }, // jamás la contraseña
  });
  return resumen;
});

export const eliminarCertificadoFirma = onCall(REGION, async (request) => {
  const { uid, claims } = requireAuth(request);

  await getStorage().bucket().file(rutaCertificado(uid)).delete().catch(() => undefined);
  await getFirestore().collection("users").doc(uid).update({ firmaElectronica: FieldValue.delete() });

  await registrarAuditoria({
    accion: "firma_certificado_eliminado",
    uid,
    centroId: claims.centroId,
    entidad: { tipo: "users", id: uid },
  });
  return { ok: true };
});

export const guardarFirmaManuscrita = onCall(REGION, async (request) => {
  const { uid, claims } = requireAuth(request);

  const parsed = guardarFirmaManuscritaSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Datos inválidos.");
  }
  // Acepta data URL o base64 pelado; se valida por los bytes, no por lo declarado.
  const bruto = parsed.data.pngBase64;
  const png = Buffer.from(bruto.slice(bruto.indexOf(",") + 1), "base64");
  if (png.length < FIRMA_PNG.length || !FIRMA_PNG.every((b, i) => png[i] === b)) {
    throw new HttpsError("invalid-argument", "La firma no es una imagen PNG válida.");
  }
  if (png.length > (FIRMA_MANUSCRITA_MAX_BASE64 * 3) / 4) {
    throw new HttpsError("invalid-argument", "La firma es demasiado grande.");
  }

  await getStorage().bucket().file(rutaManuscrita(uid)).save(png, { contentType: "image/png" });
  const ahora = new Date().toISOString();
  await getFirestore().collection("users").doc(uid).update({ firmaManuscritaAt: ahora });

  await registrarAuditoria({
    accion: "firma_manuscrita_guardada",
    uid,
    centroId: claims.centroId,
    entidad: { tipo: "users", id: uid },
  });
  return { firmaManuscritaAt: ahora };
});

/** Devuelve la firma dibujada del propio usuario para mostrar la vista previa. */
export const obtenerFirmaManuscrita = onCall(REGION, async (request) => {
  const { uid } = requireAuth(request);
  const png = await descargarOpcional(rutaManuscrita(uid));
  return { dataUrl: png ? `data:image/png;base64,${png.toString("base64")}` : null };
});
