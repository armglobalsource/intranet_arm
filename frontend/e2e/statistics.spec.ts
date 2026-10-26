import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER, timezoneId: 'America/Santiago' });
const campuses = [{ id: 1, name: 'Santiago', country: 'Chile', isActive: true }, { id: 2, name: 'Montevideo', country: 'Uruguay', isActive: true }, { id: 3, name: 'Campus histórico', country: 'Chile', isActive: false }];
const metrics = { auditorio: 100, encuentros: 2, eventos: 1, asistencia: 120, voluntarios: 30, manitosPresencial: 5, manitosOnline: 2, manitosTotal: 7, espectadoresOnline: 80, kiloAmorCajas: 8, kiloAmorRegistros: 1, promedioAsistencia: 40, promedioVoluntarios: 10 };
const quality = { total: 3, complete: 2, incomplete: 1, completeness: 67, missing: { predicador: 1 } };

async function fixture(page: Page, options: { limited?: boolean; denied?: boolean; error?: boolean; planning?: boolean; authorOnly?: boolean } = {}) {
  const requests: URL[] = [];
  await page.clock.setFixedTime(new Date('2026-10-24T15:00:00Z'));
  await page.addInitScript((options) => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 1, firstName: 'Demo', lastName: 'ARM', campusId: 1, permissions: options.denied ? [] : options.authorOnly ? ['encuentros:create'] : options.limited ? ['estadisticas:view'] : ['*'], role: { name: 'usuario' }, status: 'active' }, accessToken: 'local-fixture', isAuthenticated: true } })), options);
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith('/estadisticas')) return route.fulfill({ json: [] });
    requests.push(url);
    if (options.error) return route.fulfill({ status: 500, json: { message: 'Error de prueba' } });
    const p = url.searchParams;
    const history = p.get('period') === 'history';
    const authorized = options.limited ? campuses.slice(0, 1) : campuses;
    const visible = authorized.filter((c) => (!p.get('country') || c.country === p.get('country')) && (!p.get('campusId') || String(c.id) === p.get('campusId')));
    return route.fulfill({ json: {
      meta: { year: 2026, history, from: history ? '2020-01-01' : p.get('from'), to: history ? '2026-10-24' : p.get('to'), days: history ? 2489 : 7, legacyReports: 2, excludedReports: 1, canViewAll: !options.limited, generatedAt: '2026-10-24T15:00:00Z' },
      countries: options.limited ? ['Chile'] : ['Chile', 'Uruguay'], campuses: authorized, totals: metrics, quality,
      comparison: history ? null : { from: '2026-10-05', to: '2026-10-11', totals: { ...metrics, asistencia: 0 } },
      periods: history ? Array.from({ length: 7 }, (_, i) => ({ key: String(2020+i), label: String(2020+i), start: `${2020+i}-01-01`, end: `${2020+i}-12-31`, metrics, quality })) : [{ key: '2026-10-12', label: '12 oct', start: '2026-10-12', end: '2026-10-18', metrics, quality }],
      byCampus: visible.map((c) => ({ campusId: c.id, campusName: c.name, country: c.country, isActive: c.isActive, metrics, quality })),
      attendanceBreakdown: [{ key: 'auditorio', label: 'Auditorio', value: 100 }], volunteerBreakdown: [{ key: 'servicio', label: 'Servicio', value: 30 }],
      records: visible.flatMap((c) => Array.from({ length: options.planning ? 8 : 1 }, (_, i) => ({ id: `${c.id}-${i}`, fecha: options.planning ? new Date(Date.UTC(2026, 7, 30 + 7*i)).toISOString().slice(0,10) : '2026-10-18', fechaPrecision: 'dia', campusId: c.id, campusName: c.name, tipo: 'encuentro', encuentro: 'Domingo 11:00', predicador: 'José Pérez', mensaje: 'Esperanza', asistencia: 120, voluntarios: 30, manitosPresencial: 5, manitosOnline: 2, espectadoresOnline: 80, completeness: 67 }))),
    } });
  });
  await page.goto('/dashboard/produccion-general/estadisticas');
  return requests;
}

test('envía una semana completa y combina país/campus sin perder las opciones', async ({ page }) => {
  const requests = await fixture(page);
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  await page.getByLabel('Período', { exact: true }).selectOption('week');
  await expect.poll(() => requests.at(-1)?.searchParams.get('from')).toBe('2026-10-12');
  expect(requests.at(-1)?.searchParams.get('to')).toBe('2026-10-18');
  expect(requests.at(-1)?.searchParams.has('period')).toBe(false);
  await expect(page.getByText(/Sin base porcentual/)).toBeVisible();
  await page.getByLabel('País', { exact: true }).selectOption('Chile');
  await page.getByLabel('Campus', { exact: true }).selectOption('1');
  await expect.poll(() => requests.at(-1)?.searchParams.get('campusId')).toBe('1');
  await expect(page.getByLabel('Campus', { exact: true }).locator('option')).toHaveCount(3);
  await page.getByLabel('País', { exact: true }).selectOption('Uruguay');
  await expect(page.getByLabel('Campus', { exact: true })).toHaveValue('');
  await expect.poll(() => requests.at(-1)?.searchParams.get('country')).toBe('Uruguay');
});

test('valida fechas antes de consultar y permite filtrar por tipo', async ({ page }) => {
  const requests = await fixture(page);
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  await page.getByLabel('Período', { exact: true }).selectOption('custom');
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-31');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-01');
  const count = requests.length;
  await page.getByRole('button', { name: 'Aplicar fechas' }).click();
  await expect(page.getByText(/Selecciona fechas válidas/)).toBeVisible();
  expect(requests.length).toBe(count);
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-31');
  await page.getByRole('button', { name: 'Aplicar fechas' }).click();
  await page.getByLabel('Registros', { exact: true }).selectOption('evento');
  await expect.poll(() => requests.at(-1)?.searchParams.get('type')).toBe('evento');
  expect(requests.at(-1)?.searchParams.get('to')).toBe('2026-10-31');
});

test('navega evolución, campus históricos y búsqueda de registros sin tildes', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Vistas de estadísticas' });
  await nav.getByRole('button', { name: 'Evolución' }).click();
  await expect(page.getByText('Asistencia por categoría')).toBeVisible();
  await nav.getByRole('button', { name: 'Campus', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Campus histórico/ })).toBeVisible();
  await nav.getByRole('button', { name: 'Registros', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar registros' }).fill('jose');
  await expect(page.getByText('3 registros encontrados')).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar registros' }).fill('sin coincidencias');
  await expect(page.getByText('No existen registros para mostrar.')).toBeVisible();
});

test('un usuario de campus no ve selectores globales y sin permiso no consulta estadísticas', async ({ page }) => {
  await fixture(page, { limited: true });
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  await expect(page.getByLabel('País', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Campus', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Solo se muestran los registros de tu campus/)).toBeVisible();
});

test('sin permisos no solicita el endpoint y un fallo no se presenta como ceros', async ({ page }) => {
  const requests = await fixture(page, { denied: true });
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(requests.length).toBe(0);
});

test('error tiene reintento y oculta indicadores engañosos', async ({ page }) => {
  await fixture(page, { error: true });
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toHaveCount(0);
});

test('vista clara en escritorio y móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page);
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  await page.screenshot({ path: 'test-results/stats-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stats-mobile.png' });
});


test('abre todo el histórico desde 2020, con evolución anual y sin comparación anterior ficticia', async ({ page }) => {
  const requests = await fixture(page);
  await expect(page.getByRole('region', { name: 'Resumen de estadísticas' })).toBeVisible();
  await expect(page.getByLabel('Período', { exact: true })).toHaveValue('history');
  expect(requests[0].searchParams.get('period')).toBe('history');
  expect(requests[0].searchParams.get('groupBy')).toBe('year');
  expect(requests[0].searchParams.has('from')).toBe(false);
  await expect(page.getByRole('region', { name: 'Comparación de períodos' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Vistas de estadísticas' }).getByRole('button', { name: 'Evolución' }).click();
  await expect(page.getByText('7 años', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Año', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const count = requests.length;
  await page.getByLabel('Período', { exact: true }).selectOption('custom');
  await expect(page.getByLabel('Desde', { exact: true })).toHaveValue('2026-01-01');
  expect(requests.length).toBe(count);
});

test('agrupa Estadísticas, activa solo el submenú correcto y conserva la ruta al recargar', async ({ page }) => {
  await fixture(page);
  const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(mainNav.getByRole('button', { name: 'Contraer Estadísticas' })).toBeVisible();
  await mainNav.getByRole('link', { name: 'Calidad de datos', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cobertura de datos' })).toBeVisible();
  await expect(mainNav.getByRole('link', { name: 'Calidad de datos', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(mainNav.getByRole('link', { name: 'Resumen', exact: true })).not.toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Cobertura de datos' })).toBeVisible();
  await mainNav.getByRole('link', { name: 'Operación semanal', exact: true }).click();
  await expect(page.getByLabel('Período', { exact: true })).toHaveValue('week');
  await expect(page.getByRole('region', { name: 'Operación de estadísticas' })).toBeVisible();
});

test('proyecta con semanas cerradas, escenarios explícitos y filtros de campus', async ({ page }) => {
  const requests = await fixture(page, { planning: true });
  await page.getByRole('navigation', { name: 'Vistas de estadísticas' }).getByRole('button', { name: 'Proyecciones' }).click();
  const section = page.getByRole('region', { name: 'Proyecciones por campus' });
  await expect(section).toBeVisible();
  await expect.poll(() => requests.at(-1)?.searchParams.get('from')).toBe('2026-08-24');
  expect(requests.at(-1)?.searchParams.get('to')).toBe('2026-10-18');
  expect(requests.at(-1)?.searchParams.get('type')).toBe('encuentro');
  await expect(page.getByLabel('Período', { exact: true })).toHaveCount(0);
  await expect(section.getByText('480', { exact: true })).toHaveCount(2);
  await page.getByLabel('Variación de escenarios').selectOption('20');
  await expect(section.getByText('576', { exact: true })).toHaveCount(2);
  await page.getByLabel('Campus', { exact: true }).selectOption('1');
  await expect(section.getByRole('heading', { name: 'Montevideo', exact: true })).toHaveCount(0);
  await expect(section.getByRole('heading', { name: 'Santiago', exact: true })).toBeVisible();
  await section.screenshot({ path: 'test-results/stats-projections-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await section.screenshot({ path: 'test-results/stats-projections-mobile.png' });
});

test('no inventa proyecciones ni ofrece revisión a quien solo puede ver su campus', async ({ page }) => {
  await fixture(page, { limited: true });
  const nav = page.getByRole('navigation', { name: 'Vistas de estadísticas' });
  await nav.getByRole('button', { name: 'Proyecciones' }).click();
  await expect(page.getByText('Sin estimación disponible.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Campus', { exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Operación semanal' }).click();
  await expect(page.getByRole('link', { name: 'Abrir revisión de reportes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Registrar un encuentro' })).toHaveCount(0);
});

test('el grupo lleva al registro cuando el usuario solo tiene permiso para registrar', async ({ page }) => {
  const requests = await fixture(page, { authorOnly: true });
  await expect(page).toHaveURL(/\/dashboard$/);
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link', { name: 'Estadísticas', exact: true })).toHaveAttribute('href', '/dashboard/produccion-general/estadisticas/registrar');
  expect(requests.length).toBe(0);
});
