import { expect, test } from "@playwright/test";

/**
 * Recorrido funcional principal (F7 del plan aprobado):
 * login → crear paciente → nueva atención → generar receta y certificado
 * → verificar listas → finalizar atención.
 *
 * Se ejecuta contra los emuladores de Firebase y usa las credenciales de
 * prueba sembradas por scripts/seed.mjs (centroA / doctora).
 *
 * Deliberadamente NO cubre "Generar resumen de atención (PDF)": ese botón
 * tiene un bug pendiente, pospuesto por decisión explícita del usuario.
 */

const USUARIO = "doctora";
const PASSWORD = "Doctora1234!";

function cedulaUnica(): string {
  return `E2E-${Date.now()}`;
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#usuario").fill(USUARIO);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL("/");
}

test("login, crear paciente, nueva atención, receta y certificado, finalizar", async ({ page }) => {
  await login(page);

  // Crear paciente
  await page.goto("/pacientes/nuevo");
  const cedula = cedulaUnica();
  await page.getByLabel("Cédula").fill(cedula);
  await page.getByLabel("Sexo").selectOption("F");
  await page.getByLabel("Nombres").fill("Paciente");
  await page.getByLabel("Apellidos").fill("E2E Playwright");
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-15");
  await page.getByLabel("Teléfono").fill("0999999999");
  await page.getByLabel("Email").fill("");
  await page.getByLabel("Dirección").fill("Calle de prueba 123");
  await page.getByLabel("Alergias").fill("Ninguna conocida");
  await page.getByRole("button", { name: "Crear paciente" }).click();

  await expect(page).toHaveURL(/\/pacientes\/[^/]+$/);
  await expect(page.getByText(cedula)).toBeVisible();

  // Nueva atención (puede renderizarse como <Link> o <button>)
  const nuevaAtencion = page
    .getByRole("link", { name: "Nueva atención" })
    .or(page.getByRole("button", { name: "Nueva atención" }));
  await nuevaAtencion.click();
  await expect(page).toHaveURL(/\/pacientes\/[^/]+\/atenciones\/nueva$/);

  await page.getByLabel("1. Motivo de consulta").fill("Dolor en molar inferior derecho");
  await page.getByLabel("2. Problema actual").fill("Dolor intermitente desde hace 3 días");
  await page.getByLabel("3. Antecedentes").fill("Sin antecedentes relevantes");
  await page.getByLabel("4. Signos vitales").fill("PA 120/80, FC 72");
  await page.getByLabel("5. Examen estomatognático").fill("Sin hallazgos relevantes");

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/pacientes\/[^/]+\/atenciones\/(?!nueva$)[^/]+$/);

  // Documentos ahora es una pestaña con ruta propia dentro de la atención.
  const pestanas = page.getByRole("navigation", { name: "Secciones de la atención" });
  await pestanas.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/atenciones\/[^/]+\/documentos$/);

  // Documentos: receta
  await page.getByLabel("Diagnóstico").fill("Caries dental");
  await page.getByLabel("Indicaciones").fill("Higiene bucal reforzada");
  await page.getByLabel("Medicamentos").fill("Ibuprofeno 400mg cada 8 horas");
  await page.getByLabel("Recomendaciones").fill("Evitar alimentos fríos o calientes");
  await page.getByRole("button", { name: "Generar receta" }).click();

  const listaRecetas = page.getByRole("region", { name: "Recetas emitidas" });
  await expect(listaRecetas.getByText("Todavía no se han generado.")).toHaveCount(0);

  // Documentos: certificado
  // exact:true se conserva por prudencia ante etiquetas parecidas ("Motivo de consulta", "Notas / observaciones").
  await page.getByLabel("Motivo", { exact: true }).fill("Reposo por procedimiento odontológico");
  await page.getByLabel("Observaciones", { exact: true }).fill("Reposo relativo por 24 horas");
  await page.getByRole("button", { name: "Generar certificado" }).click();

  const listaCertificados = page.getByRole("region", { name: "Certificados emitidos" });
  await expect(listaCertificados.getByText("Todavía no se han generado.")).toHaveCount(0);

  // Finalizar atención: se vuelve a la Ficha y se confirma en el diálogo.
  await pestanas.getByRole("link", { name: "Ficha" }).click();
  await page.getByRole("button", { name: "Finalizar atención" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sí, finalizar" }).click();
  await expect(page.getByText("(finalizada)")).toBeVisible();
  await expect(page.getByText("Esta atención está finalizada y no se puede modificar.")).toBeVisible();
});
