import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER, timezoneId: 'America/Santiago' });
const person = (id: number, firstName: string, birthDate: string) => ({ id, firstName, lastName: 'Demo', birthDate, avatarUrl: null });

async function fixture(page: Page, options: { empty?: boolean; error?: boolean; missingBirthDate?: boolean } = {}) {
  await page.clock.setFixedTime(new Date('2026-12-31T15:00:00Z'));
  await page.addInitScript((missing) => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 1, firstName: 'Pablo', lastName: 'Demo', birthDate: missing ? null : '1989-12-31', permissions: [], role: { name: 'voluntario' }, status: 'active' }, accessToken: 'local-fixture', isAuthenticated: true } })), options.missingBirthDate ?? false);
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/birthdays')) return route.fulfill({ status: options.error ? 403 : 200, json: options.error ? { message: 'Error de prueba' } : options.empty ? [] : [person(1, 'Pablo', '1989-12-31'), person(2, 'Ana', '1990-01-01'), ...Array.from({ length: 7 }, (_, i) => person(i + 3, `Persona ${i + 3}`, `1990-01-${String(i + 2).padStart(2, '0')}`)), person(11, 'Fuera del período', '1990-02-15')] });
    return route.fulfill({ json: path.includes('/org/') && path.includes('/profile') ? { orgMemberships: [] } : [] });
  });
  await page.goto('/dashboard');
}

test('un perfil básico ve hoy, su saludo y próximos cumpleaños sin mostrar edades', async ({ page }) => {
  await fixture(page);
  const panel = page.getByRole('region', { name: 'Celebramos juntos' });
  await expect(panel.getByText('¡Feliz cumpleaños, Pablo!', { exact: true })).toBeVisible();
  await expect(panel.getByText('(Tú)', { exact: true })).toBeVisible();
  await expect(panel.getByText('Mañana', { exact: true })).toBeVisible();
  await expect(panel.getByText('1 de enero', { exact: true })).toBeVisible();
  await expect(panel).not.toContainText('1989');
  await expect(panel).not.toContainText(/\d+\s+años/);
  await expect(panel.getByText('Fuera del período Demo')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Ver 2 cumpleaños más' }).click();
  await expect(panel.getByText('Persona 9 Demo', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Ver menos' }).click();
  await expect(panel.getByText('Persona 9 Demo', { exact: true })).toHaveCount(0);
});

test('estados vacíos invitan a completar el perfil sin inventar cumpleaños', async ({ page }) => {
  await fixture(page, { empty: true, missingBirthDate: true });
  const panel = page.getByRole('region', { name: 'Celebramos juntos' });
  await expect(panel.getByText('No hay cumpleaños registrados para los próximos 30 días.')).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Agrega tu fecha de nacimiento en tu perfil' })).toHaveAttribute('href', '/dashboard/perfil');
  await expect(panel.getByText(/¡Feliz cumpleaños,/)).toHaveCount(0);
});

test('un error se puede reintentar y recuperar', async ({ page }) => {
  await fixture(page, { error: true });
  const panel = page.getByRole('region', { name: 'Celebramos juntos' });
  await expect(panel.getByText('No pudimos cargar los cumpleaños.')).toBeVisible({ timeout: 15000 });
  await page.route('**/api/v1/users/birthdays', (route) => route.fulfill({ json: [person(1, 'Pablo', '1989-12-31')] }));
  await panel.getByRole('button', { name: 'Reintentar cumpleaños' }).click();
  await expect(panel.getByText('¡Feliz cumpleaños, Pablo!', { exact: true })).toBeVisible();
});

test('diseño legible en escritorio y móvil, sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page);
  const panel = page.getByRole('region', { name: 'Celebramos juntos' });
  await expect(panel.getByText('Ana Demo', { exact: true })).toBeVisible();
  await panel.screenshot({ path: 'test-results/birthdays-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(panel.getByText('Ana Demo', { exact: true })).toBeVisible();
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await panel.screenshot({ path: 'test-results/birthdays-mobile.png' });
});
