import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let testEnv: RulesTestEnvironment;

const CENTRO_A = "centroA";
const CENTRO_B = "centroB";
const DOCTOR_A = "doctorA";
const DOCTOR_A2 = "doctorA2";
const DOCTOR_B = "doctorB";
const ADMIN = "admin1";

const claimsDoctor = (centroId: string) => ({ centroId, rol: "profesional" });
const claimsAdmin = () => ({ centroId: CENTRO_A, rol: "admin" });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "cident-test",
    firestore: {
      rules: readFileSync("../firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("../storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "centros", CENTRO_A), { nombre: "Centro A" });
    await setDoc(doc(db, "centros", CENTRO_B), { nombre: "Centro B" });

    await setDoc(doc(db, "users", DOCTOR_A), {
      uid: DOCTOR_A,
      centroId: CENTRO_A,
      rol: "profesional",
      usuario: "doctora",
      activo: true,
    });
    await setDoc(doc(db, "users", DOCTOR_A2), {
      uid: DOCTOR_A2,
      centroId: CENTRO_A,
      rol: "profesional",
      usuario: "doctora2",
      nombreCompleto: "Dra. Colega",
      activo: true,
    });
    await setDoc(doc(db, "users", DOCTOR_B), {
      uid: DOCTOR_B,
      centroId: CENTRO_B,
      rol: "profesional",
      usuario: "doctorb",
      activo: true,
    });

    await setDoc(doc(db, "patients", "patientA"), {
      centroId: CENTRO_A,
      cedula: "0102030405",
      nombres: "Ana",
      apellidos: "Pérez",
    });
    await setDoc(doc(db, "patients", "patientB"), {
      centroId: CENTRO_B,
      cedula: "0605040302",
      nombres: "Beto",
      apellidos: "Gómez",
    });

    await setDoc(doc(db, "patients/patientA/visits", "visitA1"), {
      centroId: CENTRO_A,
      patientId: "patientA",
      estado: "draft",
      fecha: "2026-09-01",
    });
    await setDoc(doc(db, "patients/patientA/visits", "visitAFinal"), {
      centroId: CENTRO_A,
      patientId: "patientA",
      estado: "final",
      fecha: "2026-09-02",
    });
    await setDoc(doc(db, "patients/patientB/visits", "visitB1"), {
      centroId: CENTRO_B,
      patientId: "patientB",
      estado: "draft",
      fecha: "2026-09-01",
    });

    // La cita del centro A la agendó el colega, no DOCTOR_A: es justamente lo
    // que prueba el "todos pueden todo" dentro del centro.
    await setDoc(doc(db, "appointments", "citaA1"), {
      centroId: CENTRO_A,
      patientId: "patientA",
      profesionalUid: DOCTOR_A2,
      inicio: "2026-09-29T09:00",
      fin: "2026-09-29T09:30",
      estado: "pendiente",
    });
    await setDoc(doc(db, "appointments", "citaB1"), {
      centroId: CENTRO_B,
      patientId: "patientB",
      profesionalUid: DOCTOR_B,
      inicio: "2026-09-29T09:00",
      fin: "2026-09-29T09:30",
      estado: "pendiente",
    });
  });
});

function ctxDoctorA() {
  return testEnv.authenticatedContext(DOCTOR_A, claimsDoctor(CENTRO_A));
}
function ctxDoctorB() {
  return testEnv.authenticatedContext(DOCTOR_B, claimsDoctor(CENTRO_B));
}
function ctxAdmin() {
  return testEnv.authenticatedContext(ADMIN, claimsAdmin());
}
function ctxAnon() {
  return testEnv.unauthenticatedContext();
}

describe("firestore.rules — aislamiento entre centros", () => {
  it("doctor A no puede leer un paciente del centro B", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDoc(doc(db, "patients", "patientB")));
  });

  it("doctor A puede leer un paciente de su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(getDoc(doc(db, "patients", "patientA")));
  });

  it("doctor A no puede consultar visits de collection group sin filtrar por su centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDocs(collectionGroup(db, "visits")));
  });

  it("doctor A no puede consultar visits de collection group filtrando por el centro B", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collectionGroup(db, "visits"), where("centroId", "==", CENTRO_B));
    await assertFails(getDocs(q));
  });

  it("doctor A sí puede consultar visits de collection group filtrando por su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collectionGroup(db, "visits"), where("centroId", "==", CENTRO_A));
    await assertSucceeds(getDocs(q));
  });

  it("doctor A no puede crear un paciente con centroId ajeno", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(
      setDoc(doc(db, "patients", "patientNuevo"), { centroId: CENTRO_B, cedula: "1", nombres: "x", apellidos: "y" }),
    );
  });

  it("doctor A puede crear un paciente con su propio centroId", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      setDoc(doc(db, "patients", "patientNuevo"), { centroId: CENTRO_A, cedula: "1", nombres: "x", apellidos: "y" }),
    );
  });

  it("doctor A no puede mover un paciente propio a otro centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(updateDoc(doc(db, "patients", "patientA"), { centroId: CENTRO_B }));
  });

  it("doctor A no puede escribir en users/{uid}, ni siquiera el suyo propio", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(updateDoc(doc(db, "users", DOCTOR_A), { rol: "admin" }));
  });

  it("doctor A puede leer su propio documento de users", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(getDoc(doc(db, "users", DOCTOR_A)));
  });

  it("doctor A no puede leer el documento de users de otro doctor", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDoc(doc(db, "users", DOCTOR_B)));
  });

  it("doctor A no puede modificar una atención ya finalizada", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(
      updateDoc(doc(db, "patients/patientA/visits", "visitAFinal"), { motivo: "cambio no permitido" }),
    );
  });

  it("ni el admin edita una atención finalizada en sitio: primero hay que reabrirla", async () => {
    const db = ctxAdmin().firestore();
    await assertFails(
      updateDoc(doc(db, "patients/patientA/visits", "visitAFinal"), { motivo: "corrección administrativa" }),
    );
  });

  it("doctor A puede reabrir una atención finalizada de su centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      updateDoc(doc(db, "patients/patientA/visits", "visitAFinal"), {
        estado: "draft",
        finalizedAt: null,
        finalizedBy: null,
        reabiertaAt: "2026-10-01T10:00:00.000Z",
        reabiertaBy: DOCTOR_A,
      }),
    );
  });

  it("al reabrir no se puede colar un cambio de contenido", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(
      updateDoc(doc(db, "patients/patientA/visits", "visitAFinal"), { estado: "draft", motivo: "reescrito" }),
    );
  });

  it("doctor B no puede reabrir una atención del centro A", async () => {
    const db = ctxDoctorB().firestore();
    await assertFails(
      updateDoc(doc(db, "patients/patientA/visits", "visitAFinal"), { estado: "draft", finalizedAt: null }),
    );
  });

  it("doctor A puede finalizar un borrador pero no anularlo desde el cliente", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(updateDoc(doc(db, "patients/patientA/visits", "visitA1"), { estado: "anulada" }));
    await assertSucceeds(updateDoc(doc(db, "patients/patientA/visits", "visitA1"), { estado: "final" }));
  });

  it("ni el doctor ni el admin pueden borrar una atención desde el cliente", async () => {
    await assertFails(deleteDoc(doc(ctxDoctorA().firestore(), "patients/patientA/visits", "visitA1")));
    await assertFails(deleteDoc(doc(ctxAdmin().firestore(), "patients/patientA/visits", "visitA1")));
  });

  it("doctor A no puede eliminar un paciente (solo admin)", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(deleteDoc(doc(db, "patients", "patientA")));
  });

  it("admin puede eliminar un paciente", async () => {
    const db = ctxAdmin().firestore();
    await assertSucceeds(deleteDoc(doc(db, "patients", "patientA")));
  });

  it("admin ve pacientes de ambos centros", async () => {
    const db = ctxAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, "patients", "patientA")));
    await assertSucceeds(getDoc(doc(db, "patients", "patientB")));
  });

  it("admin puede consultar visits de collection group sin filtrar por centro", async () => {
    const db = ctxAdmin().firestore();
    await assertSucceeds(getDocs(collectionGroup(db, "visits")));
  });

  it("usuario no autenticado no puede leer nada", async () => {
    const db = ctxAnon().firestore();
    await assertFails(getDoc(doc(db, "patients", "patientA")));
  });

  it("nadie puede leer la colección userSecrets desde el cliente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "userSecrets", DOCTOR_A), { passwordHash: "x" });
    });
    const db = ctxAdmin().firestore();
    await assertFails(getDoc(doc(db, "userSecrets", DOCTOR_A)));
  });

  it("nadie puede leer la colección rateLimits desde el cliente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "rateLimits", "ip_1.2.3.4"), { intentos: 1, ventanaInicio: 0 });
    });
    const db = ctxAdmin().firestore();
    await assertFails(getDoc(doc(db, "rateLimits", "ip_1.2.3.4")));
  });

  it("doctor A no puede crear un patientIds con clave que no coincide con centroId_cedula", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(
      setDoc(doc(db, "patientIds", "claveInventada"), { centroId: CENTRO_A, cedula: "999", patientId: "x" }),
    );
  });

  it("doctor A puede crear un patientIds con la clave correcta", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      setDoc(doc(db, "patientIds", `${CENTRO_A}_999`), { centroId: CENTRO_A, cedula: "999", patientId: "x" }),
    );
  });

  it("doctor A no puede leer los pacientes del centro B mediante una query sin filtro válido", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDocs(collection(db, "patients")));
  });
});

describe("firestore.rules — agenda compartida dentro del centro", () => {
  it("doctor A no puede leer una cita del centro B", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDoc(doc(db, "appointments", "citaB1")));
  });

  it("doctor A puede leer la cita de un colega de su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(getDoc(doc(db, "appointments", "citaA1")));
  });

  it("doctor A no puede listar citas sin filtrar por su centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDocs(collection(db, "appointments")));
  });

  it("doctor A no puede listar las citas del centro B", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collection(db, "appointments"), where("centroId", "==", CENTRO_B));
    await assertFails(getDocs(q));
  });

  it("doctor A sí puede listar las citas de su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collection(db, "appointments"), where("centroId", "==", CENTRO_A));
    await assertSucceeds(getDocs(q));
  });

  it("doctor A puede crear una cita en su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      setDoc(doc(db, "appointments", "citaNueva"), {
        centroId: CENTRO_A,
        profesionalUid: DOCTOR_A,
        inicio: "2026-09-29T15:00",
        fin: "2026-09-29T15:30",
        estado: "pendiente",
      }),
    );
  });

  it("doctor A no puede crear una cita con centroId ajeno", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(
      setDoc(doc(db, "appointments", "citaNueva"), {
        centroId: CENTRO_B,
        profesionalUid: DOCTOR_A,
        inicio: "2026-09-29T15:00",
        fin: "2026-09-29T15:30",
        estado: "pendiente",
      }),
    );
  });

  it("doctor A puede agendar a nombre de un colega del mismo centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      setDoc(doc(db, "appointments", "citaParaColega"), {
        centroId: CENTRO_A,
        profesionalUid: DOCTOR_A2,
        inicio: "2026-09-29T16:00",
        fin: "2026-09-29T16:30",
        estado: "pendiente",
      }),
    );
  });

  it("doctor A puede editar la cita de un colega: la agenda es del centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(updateDoc(doc(db, "appointments", "citaA1"), { motivo: "reprogramada" }));
  });

  it("doctor A puede cancelar la cita de un colega cambiando el estado", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(
      updateDoc(doc(db, "appointments", "citaA1"), {
        estado: "cancelada",
        canceladaPor: DOCTOR_A,
        motivoCancelacion: "el paciente avisó",
      }),
    );
  });

  it("doctor A no puede editar una cita del centro B", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(updateDoc(doc(db, "appointments", "citaB1"), { motivo: "intrusión" }));
  });

  it("doctor A no puede mover una cita de su centro a otro", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(updateDoc(doc(db, "appointments", "citaA1"), { centroId: CENTRO_B }));
  });

  it("doctor A no puede borrar una cita: cancelar es cambiar el estado", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(deleteDoc(doc(db, "appointments", "citaA1")));
  });

  it("admin sí puede borrar una cita", async () => {
    const db = ctxAdmin().firestore();
    await assertSucceeds(deleteDoc(doc(db, "appointments", "citaA1")));
  });

  it("un usuario no autenticado no puede leer citas", async () => {
    const db = ctxAnon().firestore();
    await assertFails(getDoc(doc(db, "appointments", "citaA1")));
  });

  it("doctor A puede leer el perfil de un colega de su centro, para nombrarlo en la agenda", async () => {
    const db = ctxDoctorA().firestore();
    await assertSucceeds(getDoc(doc(db, "users", DOCTOR_A2)));
  });

  it("doctor A sí puede listar los users de su propio centro", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collection(db, "users"), where("centroId", "==", CENTRO_A));
    await assertSucceeds(getDocs(q));
  });

  it("doctor A no puede listar users sin filtrar por su centro", async () => {
    const db = ctxDoctorA().firestore();
    await assertFails(getDocs(collection(db, "users")));
  });

  it("doctor A no puede listar los users del centro B", async () => {
    const db = ctxDoctorA().firestore();
    const q = query(collection(db, "users"), where("centroId", "==", CENTRO_B));
    await assertFails(getDocs(q));
  });

  it("la lectura ampliada de users no alcanza al userSecrets del colega", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "userSecrets", DOCTOR_A2), { passwordHash: "x" });
    });
    const db = ctxDoctorA().firestore();
    await assertFails(getDoc(doc(db, "userSecrets", DOCTOR_A2)));
  });
});

describe("storage.rules — aislamiento entre centros", () => {
  it("doctor A puede subir a su propia carpeta de staging", async () => {
    const storage = ctxDoctorA().storage();
    await assertSucceeds(
      uploadBytes(ref(storage, `uploads/${CENTRO_A}/${DOCTOR_A}/archivo.txt`), new Uint8Array([1, 2, 3])),
    );
  });

  it("doctor A no puede subir a un staging con centroId ajeno", async () => {
    const storage = ctxDoctorA().storage();
    await assertFails(
      uploadBytes(ref(storage, `uploads/${CENTRO_B}/${DOCTOR_A}/archivo.txt`), new Uint8Array([1, 2, 3])),
    );
  });

  it("doctor A no puede subir a la carpeta de staging de otro usuario", async () => {
    const storage = ctxDoctorA().storage();
    await assertFails(
      uploadBytes(ref(storage, `uploads/${CENTRO_A}/${DOCTOR_B}/archivo.txt`), new Uint8Array([1, 2, 3])),
    );
  });

  it("doctor A no puede escribir directamente en la carpeta definitiva de su centro (solo la CF)", async () => {
    const storage = ctxDoctorA().storage();
    await assertFails(
      uploadBytes(ref(storage, `centros/${CENTRO_A}/pacientes/p1/adjuntos/x.txt`), new Uint8Array([1])),
    );
  });

  it("doctor A no puede leer un archivo definitivo del centro B", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), `centros/${CENTRO_B}/pacientes/p1/adjuntos/x.txt`),
        new Uint8Array([1, 2, 3]),
      );
    });
    const storage = ctxDoctorA().storage();
    await assertFails(getBytes(ref(storage, `centros/${CENTRO_B}/pacientes/p1/adjuntos/x.txt`)));
  });

  it("doctor A puede leer un archivo definitivo de su propio centro", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), `centros/${CENTRO_A}/pacientes/p1/adjuntos/x.txt`),
        new Uint8Array([1, 2, 3]),
      );
    });
    const storage = ctxDoctorA().storage();
    await assertSucceeds(getBytes(ref(storage, `centros/${CENTRO_A}/pacientes/p1/adjuntos/x.txt`)));
  });

  it("admin puede leer archivos definitivos de cualquier centro", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), `centros/${CENTRO_B}/pacientes/p1/adjuntos/x.txt`),
        new Uint8Array([1, 2, 3]),
      );
    });
    const storage = ctxAdmin().storage();
    await assertSucceeds(getBytes(ref(storage, `centros/${CENTRO_B}/pacientes/p1/adjuntos/x.txt`)));
  });

  it("nadie puede borrar un archivo definitivo desde el cliente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(context.storage(), `centros/${CENTRO_A}/pacientes/p1/adjuntos/x.txt`),
        new Uint8Array([1, 2, 3]),
      );
    });
    const storage = ctxAdmin().storage();
    await assertFails(deleteObject(ref(storage, `centros/${CENTRO_A}/pacientes/p1/adjuntos/x.txt`)));
  });
});

describe("sanity", () => {
  it("el entorno de reglas se inicializó", () => {
    expect(testEnv).toBeDefined();
  });
});
