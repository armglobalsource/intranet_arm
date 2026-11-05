import { test, expect, type Page } from '@playwright/test';
import closed from './fixtures/weekly-report.json';
import current from './fixtures/weekly-report-current.json';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER });

async function fixture(page: Page, permissions = ['estadisticas:view', 'estadisticas:viewAll']) {
  await page.addInitScript((permissions) => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 30, firstName: 'Camila', lastName: 'ARM', campusId: 1, permissions, status: 'active' }, accessToken: 'test-only', isAuthenticated: true } })), permissions);
  const calls: { method: string; path: string; query: string; body: any }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1', '');
    calls.push({ method: req.method(), path, query: url.search, body: req.postDataJSON() });
    if (path === '/estadisticas/reporte-semanal') return route.fulfill({ json: url.searchParams.get('semana') === '2026-11-02' ? current : closed });
    if (path === '/estadisticas/reporte-semanal/destinatarios') return route.fulfill({ json: { destinatarios: ['equipo@armglobal.org'], disponible: true } });
    if (path === '/estadisticas/reporte-semanal/enviar') return route.fulfill({ json: { enviado: true, destinatarios: req.postDataJSON().destinatarios.length } });
    return route.fulfill({ json: [] });
  });
  await page.clock.setFixedTime(new Date('2026-11-06T00:30:00Z')); // jueves 5 de noviembre, 21:30 en Chile
  return calls;
}

for (const width of [393, 1280]) {
  test(`reporte semanal ${width}px: abre la semana en curso con sus pendientes`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal');
    await expect(page.getByLabel('Semana', { exact: true })).toHaveValue('2026-11-02');
    await expect(page.getByText('Semana en curso.')).toBeVisible();
    const pending = page.getByRole('region', { name: 'Pendientes antes de enviar' });
    await expect(pending.getByRole('heading')).toHaveText('Pendientes antes de enviar (2)');
    await expect(pending).toContainText('Sin reporte');
    await expect(pending).toContainText('Punta Arenas');
    await expect(pending).toContainText('Por revisar');
    await expect(pending).toContainText('Montevideo');
    const preview = page.getByRole('region', { name: 'Vista previa del reporte' });
    await expect(preview).toContainText('Prog.');
    // Los avisos se muestran una vez en la página, no repetidos en la vista previa.
    await expect(preview).not.toContainText('Datos incompletos:');
    await expect(page.getByText('Sumar también los reportes por revisar')).toBeVisible();
    // Enviar queda al final, después de la vista previa.
    const send = page.getByRole('region', { name: 'Enviar el reporte' });
    expect((await send.boundingBox())!.y).toBeGreaterThan((await preview.boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/reporte-semanal-en-curso-${width}.png` });

    // Enviar exige reconocer que el reporte está incompleto.
    await page.getByRole('button', { name: 'Enviar por correo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enviar el reporte por correo' });
    await expect(dialog.getByRole('textbox')).toHaveValue('equipo@armglobal.org');
    await expect(dialog).toContainText('desde cualquier equipo');
    await dialog.getByRole('textbox').fill('camila@armglobal.org');
    const sendButton = dialog.getByRole('button', { name: 'Enviar reporte incompleto' });
    await expect(sendButton).toBeDisabled();
    await dialog.getByRole('checkbox').check();
    await expect(sendButton).toBeEnabled();
    await page.screenshot({ path: `test-results/reporte-semanal-envio-${width}.png` });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });
}

test('reporte semanal: semana cerrada, envío, Excel y reportes por revisar', async ({ page }) => {
  const calls = await fixture(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal');
  await page.getByRole('button', { name: 'Ver semana cerrada' }).click();
  await expect(page.getByLabel('Semana', { exact: true })).toHaveValue('2026-10-26');
  await expect(page.getByLabel('Totales de la semana')).toContainText('3.596');
  const preview = page.getByRole('region', { name: 'Vista previa del reporte' });
  await expect(preview).toContainText('RESUMEN SEMANA ANTERIOR VS LA ACTUAL');
  await expect(preview).toContainText('Sem. 19 al 25 Oct');
  await expect(preview).toContainText('Los datos de JVNS X TEENS se sumaron');
  await page.screenshot({ path: 'test-results/reporte-semanal-cerrada-1280.png' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar Excel' }).click();
  expect((await download).suggestedFilename()).toBe('reporte-semanal-2026-10-26.xlsx');

  await page.getByRole('button', { name: 'Enviar por correo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Enviar el reporte por correo' });
  await dialog.getByRole('textbox').fill('camila@armglobal.org, malo@');
  await expect(dialog.getByText('Revisa: malo@')).toBeVisible();
  await dialog.getByRole('textbox').fill('camila@armglobal.org\npastor@armglobal.org');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Enviar reporte incompleto' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Reporte enviado a 2 destinatarios.' })).toBeVisible();
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ semana: '2026-10-26', porRevisar: false, destinatarios: ['camila@armglobal.org', 'pastor@armglobal.org'] });

  await page.getByLabel('Sumar también los reportes por revisar').check();
  await expect.poll(() => calls.some((c) => c.path === '/estadisticas/reporte-semanal' && c.query.includes('porRevisar=1'))).toBe(true);
});

test('reporte semanal: sin permiso de todos los campus no se muestra', async ({ page }) => {
  await fixture(page, ['estadisticas:view']);
  await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal');
  await expect(page.getByText('Para verlo necesitas el permiso «Ver estadísticas de todos los campus».')).toBeVisible();
});
