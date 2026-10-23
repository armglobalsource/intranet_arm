import { test, expect } from '@playwright/test';

const TIMESTAMP = Date.now();
const TEST_EMAIL = `test.playwright.${TIMESTAMP}@example.com`;

test.describe('Registro de nueva cuenta', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  });

  // ── Escenario 1: Registro manual ──────────────────────────────────────────

  test('registro manual completo con contraseña', async ({ page }) => {
    await page.getByPlaceholder('Juan').fill('Playwright');
    await page.getByPlaceholder('Pérez').fill('Test');
    await page.getByPlaceholder('usuario@empresa.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456');
    await page.getByPlaceholder('Repite la contraseña').fill('123456');

    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page).toHaveURL(/\/(auth\/complete-profile|dashboard)/, { timeout: 10000 });
  });

  test('muestra error cuando las contraseñas no coinciden', async ({ page }) => {
    await page.getByPlaceholder('Juan').fill('Juan');
    await page.getByPlaceholder('Pérez').fill('Pérez');
    await page.getByPlaceholder('usuario@empresa.com').fill(`mismatch.${TIMESTAMP}@example.com`);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456');
    await page.getByPlaceholder('Repite la contraseña').fill('654321');

    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.getByText(/las contraseñas no coinciden/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('muestra error cuando el email ya está registrado', async ({ page }) => {
    // Email único para este test (no reusar TEST_EMAIL que ya usa el primer test)
    const dupEmail = `dup.playwright.${TIMESTAMP}@example.com`;

    // Registrar primero
    await page.getByPlaceholder('Juan').fill('Usuario');
    await page.getByPlaceholder('Pérez').fill('Duplicado');
    await page.getByPlaceholder('usuario@empresa.com').fill(dupEmail);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456');
    await page.getByPlaceholder('Repite la contraseña').fill('123456');
    await page.getByRole('button', { name: /crear cuenta/i }).click();
    await page.waitForURL(/\/(auth\/complete-profile|dashboard)/, { timeout: 10000 });

    // Limpiar sesión para poder volver al registro
    await page.evaluate(() => localStorage.clear());

    // Intentar registrar de nuevo con el mismo email
    await page.goto('/auth/register');
    await page.getByPlaceholder('Juan').fill('Otro');
    await page.getByPlaceholder('Pérez').fill('Usuario');
    await page.getByPlaceholder('usuario@empresa.com').fill(dupEmail);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456');
    await page.getByPlaceholder('Repite la contraseña').fill('123456');
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.getByText(/ya tiene una cuenta/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('muestra error si el email tiene formato inválido', async ({ page }) => {
    // Rellenar todos los campos para que React Hook Form valide (no la validación nativa del browser)
    await page.getByPlaceholder('Juan').fill('Test');
    await page.getByPlaceholder('Pérez').fill('User');
    await page.getByPlaceholder('usuario@empresa.com').fill('no-es-un-email');
    await page.getByPlaceholder('Mínimo 6 caracteres').fill('123456');
    await page.getByPlaceholder('Repite la contraseña').fill('123456');

    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.getByText(/email inválido/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  // ── Navegación ────────────────────────────────────────────────────────────

  test('enlace "Inicia sesión" lleva al login', async ({ page }) => {
    await page.getByRole('link', { name: /inicia sesión/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

});
