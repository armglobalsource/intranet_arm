import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER });

async function fixture(page: Page, ownOnly = false) {
  const report = { id: 'fixture-report', campusId: 1, campus: 'Santiago', tipo: 'encuentro', fecha: '2026-10-18', encuentro: 'Encuentro Domingo 11:00 hrs', modalidad: 'Presencial+Online', estado: 'enviado', observacion: '', asistencia: { auditorio: 35 }, totalAsistencia: 35, totalVoluntarios: 4, registradoPor: { uid: 7, email: 'author@example.test' } };
  const calls: { method: string; path: string; body: any }[] = [];
  await page.addInitScript((ownOnly) => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: ownOnly ? 7 : 8, firstName: 'Demo', lastName: 'ARM', campusId: ownOnly ? 1 : 2, permissions: ownOnly ? ['encuentros:create'] : [], status: 'active' }, accessToken: 'test-only', isAuthenticated: true } })), ownOnly);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1', '');
    const body = req.postDataJSON();
    calls.push({ method: req.method(), path, body });
    if (path === '/campus') return route.fulfill({ json: [{ id: 1, name: 'Santiago', isActive: true, schedules: [] }, { id: 2, name: 'Puente Alto', isActive: true, schedules: [] }] });
    if (path === '/encuentros/revision') return route.fulfill({ json: { campusIds: ownOnly ? [] : [1], items: report.estado === 'subido' ? [] : [report] } });
    if (path === '/encuentros/pendientes') return route.fulfill({ json: { pendientes: [], revisar: [] } });
    if (path === '/encuentros/mine') return route.fulfill({ json: [report] });
    if (path === '/encuentros/fixture-report/observar') { report.estado = 'observado'; report.observacion = body.observacion; return route.fulfill({ json: report }); }
    if (path === '/encuentros/fixture-report/subir') { report.estado = 'subido'; return route.fulfill({ json: report }); }
    if (path === '/encuentros/fixture-report') return route.fulfill({ json: report });
    return route.fulfill({ json: [] });
  });
  return calls;
}

test('el administrador listado devuelve un reporte y lo sube desde Observados', async ({ page }) => {
  const calls = await fixture(page);
  await page.goto('/dashboard/produccion-general/estadisticas/revisar');
  await expect(page.getByRole('heading', { name: 'Encuentro Domingo 11:00 hrs' })).toBeVisible();
  await page.getByRole('button', { name: 'Devolver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Devolver al líder' })).toBeDisabled();
  await page.getByLabel('¿Qué hay que corregir?').fill('Falta Kids');
  await page.getByRole('button', { name: 'Devolver al líder' }).click();
  await expect(page.getByRole('tab', { name: 'Observados (1)' })).toBeVisible();
  await page.getByRole('tab', { name: 'Observados (1)' }).click();
  await expect(page.getByText('Observación enviada:')).toBeVisible();
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
  await expect(page.getByText('No hay reportes devueltos esperando corrección.')).toBeVisible();
  expect(calls.filter((r) => r.method === 'PATCH').map((r) => r.path)).toEqual(['/encuentros/fixture-report/observar', '/encuentros/fixture-report/subir']);
});

test('editar desde revisión muestra el campus del reporte aunque el revisor pertenezca a otro', async ({ page }) => {
  await fixture(page);
  await page.goto('/dashboard/produccion-general/estadisticas/registrar?editar=fixture-report');
  await expect(page.getByRole('heading', { name: 'Editar registro' })).toBeVisible();
  await expect(page.getByText('Estadísticas · Santiago', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
});

test('un líder sin permiso de lectura del campus puede consultar sus propios reportes', async ({ page }) => {
  const calls = await fixture(page, true);
  await page.goto('/dashboard/produccion-general/estadisticas/registrar');
  await expect(page.getByRole('region', { name: 'Registros recientes' }).getByText('Encuentro Domingo 11:00 hrs')).toBeVisible();
  expect(calls.some((r) => r.path === '/encuentros/mine')).toBe(true);
  expect(calls.some((r) => r.path === '/encuentros')).toBe(false);
});
