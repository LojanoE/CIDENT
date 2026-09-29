import { expect, test, type Page } from "@playwright/test";

/**
 * Agenda compartida del centro: agendar una cita con paciente nuevo (sin ficha),
 * ver la advertencia de solapamiento sin que bloquee, y cancelar.
 *
 * Usa un día lejano distinto en cada corrida para no chocar con las anteriores.
 */

const USUARIO = "doctora";
const PASSWORD = "Doctora1234!";
// Los emuladores conservan datos entre corridas: cada ejecución usa su propio día
// (entre 2031 y 2040) para que las citas de una corrida no choquen con las de otra.
const semilla = Math.floor(Date.now() / 1000);
const DIA = `${2031 + (semilla % 10)}-${String(1 + (Math.floor(semilla / 10) % 12)).padStart(2, "0")}-${String(1 + (Math.floor(semilla / 120) % 28)).padStart(2, "0")}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#usuario").fill(USUARIO);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL("/");
}

async function agendar(page: Page, nombre: string, hora: string) {
  await page.getByRole("button", { name: "Nueva cita" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nombre del paciente").fill(nombre);
  await sheet.getByLabel("Teléfono").fill("0991112233");
  await sheet.getByLabel("Fecha").fill(DIA);
  await sheet.getByLabel("Hora de inicio").fill(hora);
  await sheet.getByLabel("Motivo").fill("Control");
  return sheet;
}

test("agendar, advertir solapamiento sin bloquear y cancelar", async ({ page }) => {
  await login(page);
  await page.goto("/agenda");
  await page.getByLabel("Fecha", { exact: true }).fill(DIA);

  const sufijo = Date.now();
  const primera = `Cita Uno ${sufijo}`;
  const segunda = `Cita Dos ${sufijo}`;

  // Primera cita: sin conflicto.
  let sheet = await agendar(page, primera, "10:00");
  await expect(sheet.getByRole("status")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(primera).first()).toBeVisible();

  // Segunda cita a la misma hora del mismo profesional: avisa, pero deja guardar.
  sheet = await agendar(page, segunda, "10:00");
  await expect(sheet.getByRole("status")).toContainText(primera);
  await sheet.getByRole("button", { name: "Agendar cita" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(segunda).first()).toBeVisible();
  await expect(page.getByText(primera).first()).toBeVisible();

  // Cancelar la segunda: deja de ocupar la franja.
  await page.getByText(segunda).first().click();
  const editar = page.getByRole("dialog", { name: "Editar cita" });
  await editar.getByRole("button", { name: "Cancelar cita" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar cita" }).click();
  await expect(page.getByRole("region", { name: "Canceladas y ausentes" })).toContainText(segunda);
});
