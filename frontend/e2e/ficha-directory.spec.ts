import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER });
const url = '/dashboard/fichas-tecnicas';

async function directoryFixture(page: Page) {
  const campuses = [
    { id: 1, name: 'Santiago', siglas: 'CS', country: 'Chile', isActive: true },
    { id: 2, name: 'Concepción', siglas: 'CCP', country: 'CL', isActive: true },
    { id: 3, name: 'Montevideo', siglas: 'CMV', country: 'Uruguay', isActive: true },
    { id: 4, name: 'Campus anterior', country: 'Argentina', isActive: false },
    { id: 5, name: 'Nuevo campus', country: null, isActive: true },
  ];
  const ficha = (id: string, campusId: number, title: string, status: string, archived = false) => ({ fichaId: id, campusId: String(campusId), campusName: campuses.find((c) => c.id === campusId)!.name, title, status, archived, date: '2026-10-25', type: 'unico', completionStatus: { pastoral: status === 'complete', escena: status === 'complete' } });
  const fichas = [ficha('1', 1, 'Domingo Santiago', 'complete'), ficha('2', 1, 'Noche de oración', 'in_progress'), ficha('3', 2, 'Encuentro Concepción', 'draft'), ficha('4', 3, 'Domingo Montevideo', 'complete'), ficha('5', 4, 'Encuentro histórico', 'complete'), ficha('6', 5, 'Bienvenida nueva sede', 'draft'), ficha('7', 1, 'Ficha archivada', 'complete', true)];
  await page.addInitScript(() => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 1, firstName: 'Usuario', lastName: 'Demo', permissions: ['*'], role: { name: 'admin' }, status: 'active' }, accessToken: 'local-fixture', isAuthenticated: true } })));
  // Intercept all API traffic; no production reads or writes.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const data = path.endsWith('/fichas') ? fichas : path.endsWith('/campus') || path.endsWith('/campus/active') ? campuses : [];
    return route.fulfill({ json: data });
  });
  await page.goto(url);
  await expect(page.getByRole('region', { name: 'Filtrar por país' })).toBeVisible();
}

test('país, campus y estado combinan resultados y resumen sin incluir archivadas', async ({ page }) => {
  await directoryFixture(page);
  await expect(page.getByRole('button', { name: 'Fichas activas: 6', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Filtrar por país' }).getByRole('button', { name: /^Chile/ }).click();
  await expect(page.getByRole('button', { name: 'Fichas activas: 3', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fichas de Uruguay' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Campus' }).selectOption('campus:1');
  await expect(page.getByRole('button', { name: 'Fichas activas: 2', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Buscar y filtrar fichas' }).getByRole('button', { name: 'En progreso', exact: true }).click();
  await expect(page.getByText('Noche de oración', { exact: true })).toBeVisible();
  await expect(page.getByText('Domingo Santiago', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ficha archivada', { exact: true })).toHaveCount(0);
});

test('cambiar país reinicia campus; búsqueda sin tildes abre coincidencias y puede limpiarse', async ({ page }) => {
  await directoryFixture(page);
  await page.getByRole('combobox', { name: 'Campus' }).selectOption('campus:1');
  await page.getByRole('region', { name: 'Filtrar por país' }).getByRole('button', { name: /^Uruguay/ }).click();
  await expect(page.getByRole('combobox', { name: 'Campus' })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Fichas activas: 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await page.getByRole('searchbox').fill('concepcion');
  await expect(page.getByText('Encuentro Concepción', { exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('no existe');
  await expect(page.getByText('No encontramos fichas con estos filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Fichas activas: 6', exact: true })).toBeVisible();
});

test('conserva campus inactivos y muestra los de país desconocido sin inventar asignaciones', async ({ page }) => {
  await directoryFixture(page);
  await expect(page.getByRole('region', { name: 'Fichas de Argentina' }).getByRole('heading', { name: 'Campus anterior' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fichas de Sin país asignado' }).getByRole('heading', { name: 'Nuevo campus' })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir campus', exact: true }).click();
  await expect(page.getByText('Encuentro histórico', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Contraer campus', exact: true }).click();
  await expect(page.getByText('Encuentro histórico', { exact: true })).toHaveCount(0);
});

test('diseño claro adaptable sin desbordar los filtros en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await directoryFixture(page);
  await page.getByRole('region', { name: 'Filtrar por país' }).getByRole('button', { name: /^Chile/ }).click();
  await page.getByRole('button', { name: 'Expandir campus', exact: true }).click();
  await page.screenshot({ path: 'test-results/fichas-paises-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('region', { name: 'Filtrar por país' }).getByRole('button', { name: /^Chile/ }).click();
  await page.getByRole('button', { name: 'Expandir campus', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Campus' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/fichas-paises-mobile.png', fullPage: true });
});

test('error del catálogo ofrece reintento y no clasifica países erróneamente', async ({ page }) => {
  await directoryFixture(page);
  await page.route('**/api/v1/campus', (route) => route.fulfill({ status: 403, json: { message: 'No disponible' } }));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo cargar el catálogo' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fichas de Sin país asignado' })).toHaveCount(0);
});
