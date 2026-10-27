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
    if (path === '/arm-catalogos/active') return route.fulfill({ json: url.searchParams.get('tipo') === 'asistencia' ? [{ key: 'auditorio', label: 'Auditorio' }, { key: 'kids', label: 'Niños y niñas de Kids' }] : [{ key: 'servicio', label: 'Equipo de servicio' }] });
    if (path === '/encuentros' && req.method() === 'POST') return route.fulfill({ json: { ...body, id: 'created-report', estado: 'enviado' } });
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
  await page.setViewportSize({ width: 393, height: 852 });
  const calls = await fixture(page);
  await page.goto('/dashboard/produccion-general/estadisticas/revisar');
  await expect(page.getByRole('heading', { name: 'Encuentro Domingo 11:00 hrs' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stats-revision-iphone.png' });
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

for (const width of [320, 393, 834]) {
  test(`registro ${width}px: formulario alineado y envío de cifras`, async ({ page }) => {
    const calls = await fixture(page, true);
    await page.clock.setFixedTime(new Date('2026-10-28T15:00:00Z'));
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/dashboard/produccion-general/estadisticas/registrar');
    await page.getByLabel('Fecha', { exact: true }).fill('2026-10-20');
    await page.getByRole('combobox', { name: 'Encuentro', exact: true }).selectOption('__otro__');
    await page.getByLabel('Nombre del encuentro').fill('Encuentro Martes 19:00 hrs');
    await page.getByRole('combobox', { name: 'Modalidad', exact: true }).selectOption('Presencial+Online');
    await page.getByLabel('Auditorio', { exact: true }).fill('125');
    await page.getByLabel('Niños y niñas de Kids', { exact: true }).fill('15');
    await page.getByLabel('Equipo de servicio', { exact: true }).fill('12');
    await page.getByLabel('Aceptaron a Jesús (presencial)', { exact: true }).fill('3');
    await page.getByLabel('Aceptaron a Jesús (online)', { exact: true }).fill('2');
    await page.getByLabel('Espectadores online', { exact: true }).fill('80');
    const inputs = page.locator('.stats-number-field input');
    expect(await inputs.evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
    const first = await inputs.nth(0).boundingBox(), second = await inputs.nth(1).boundingBox();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Auditorio', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/stats-registro-${width}.png` });
    await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reporte enviado:' })).toBeInViewport();
    const sent = calls.find(c => c.method === 'POST' && c.path === '/encuentros')?.body;
    expect(sent.asistencia).toEqual({ auditorio: 125, kids: 15 });
    expect(sent.voluntarios).toEqual({ servicio: 12 });
    expect(sent.online).toEqual({ acepto: 2, espectadores: 80 });
  });
}

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
