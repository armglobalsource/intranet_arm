import { test, expect, type Page } from '@playwright/test';
import report from './fixtures/weekly-report.json';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER });

async function fixture(page: Page, permissions = ['estadisticas:view', 'estadisticas:viewAll']) {
  await page.addInitScript((permissions) => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 30, firstName: 'Camila', lastName: 'ARM', campusId: 1, permissions, status: 'active' }, accessToken: 'test-only', isAuthenticated: true } })), permissions);
  const calls: { method: string; path: string; query: string; body: any }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1', '');
    calls.push({ method: req.method(), path, query: url.search, body: req.postDataJSON() });
    if (path === '/estadisticas/reporte-semanal') return route.fulfill({ json: report });
    if (path === '/estadisticas/reporte-semanal/enviar') return route.fulfill({ json: { enviado: true, destinatarios: req.postDataJSON().destinatarios.length } });
    return route.fulfill({ json: [] });
  });
  return calls;
}

for (const width of [393, 1280]) {
  test(`reporte semanal ${width}px: totales, avisos, vista previa y envío`, async ({ page }) => {
    const calls = await fixture(page);
    await page.clock.setFixedTime(new Date('2026-11-05T15:00:00Z'));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal');
    await expect(page.getByRole('heading', { name: 'Reporte semanal', exact: true })).toBeVisible();
    await expect(page.getByLabel('Semana', { exact: true })).toHaveValue('2026-10-26');
    expect(calls.some((c) => c.path === '/estadisticas/reporte-semanal' && c.query.includes('semana=2026-10-26'))).toBe(true);
    const kpis = page.getByLabel('Totales de la semana');
    await expect(kpis).toContainText('3.596');
    await expect(page.getByText('Hay datos incompletos en esta semana.')).toBeVisible();
    const preview = page.getByRole('region', { name: 'Vista previa del reporte' });
    await expect(preview).toContainText('REPORTE SEMANAL');
    await expect(preview).toContainText('RESUMEN SEMANA ANTERIOR VS LA ACTUAL');
    await expect(preview).toContainText('Los datos de JVNS X TEENS se sumaron');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/reporte-semanal-${width}.png`, fullPage: width > 1000 });

    await page.getByRole('button', { name: 'Enviar por correo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Enviar el reporte por correo' });
    await dialog.getByRole('textbox').fill('camila@armglobal.org, malo@');
    await expect(dialog.getByText('Revisa: malo@')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Enviar reporte' })).toBeDisabled();
    await dialog.getByRole('textbox').fill('camila@armglobal.org\npastor@armglobal.org');
    await page.screenshot({ path: `test-results/reporte-semanal-envio-${width}.png` });
    await dialog.getByRole('button', { name: 'Enviar reporte' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Reporte enviado a 2 destinatarios.' })).toBeVisible();
    const sent = calls.find((c) => c.method === 'POST')!.body;
    expect(sent).toEqual({ semana: '2026-10-26', porRevisar: false, destinatarios: ['camila@armglobal.org', 'pastor@armglobal.org'] });
  });
}

test('reporte semanal: descarga el Excel y permite incluir los reportes por revisar', async ({ page }) => {
  const calls = await fixture(page);
  await page.clock.setFixedTime(new Date('2026-11-05T15:00:00Z'));
  await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal?semana=2026-10-29');
  await expect(page.getByLabel('Semana', { exact: true })).toHaveValue('2026-10-26');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar Excel' }).click();
  expect((await download).suggestedFilename()).toBe('reporte-semanal-2026-10-26.xlsx');
  await page.getByLabel('Incluir reportes por revisar').check();
  await expect.poll(() => calls.some((c) => c.path === '/estadisticas/reporte-semanal' && c.query.includes('porRevisar=1'))).toBe(true);
});

test('reporte semanal: sin permiso de todos los campus no se muestra', async ({ page }) => {
  await fixture(page, ['estadisticas:view']);
  await page.goto('/dashboard/produccion-general/estadisticas/reporte-semanal');
  await expect(page.getByText('Para verlo necesitas el permiso «Ver estadísticas de todos los campus».')).toBeVisible();
});
