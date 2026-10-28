import {test, expect} from '@playwright/test';

test.use({baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER});

const fichas = [
  {fichaId: 'oracion', campusId: '1', campusName: 'Santiago', type: 'oracion', title: 'Miércoles Oración', date: '2026-10-28T12:00:00Z', status: 'complete', encuentros: [{id: 'unico', label: 'Encuentro Oración', time: '06:00'}]},
  {fichaId: 'global', campusId: '1', campusName: 'Santiago', type: 'unico', title: 'Miércoles Global', date: '2026-10-28T12:00:00Z', status: 'in_progress', encuentros: [{id: 'unico', label: 'Miércoles Global', time: '20:00'}]},
  {fichaId: 'domingo', campusId: '2', campusName: 'Puente Alto', type: 'unico', title: 'Domingo AM', date: '2026-11-01T12:00:00Z', status: 'complete', encuentros: [{id: 'unico', label: 'Encuentro Domingo', time: '11:00'}]},
];

for (const width of [320, 393, 834, 1366]) {
  test(`agenda clara ${width}px: filtrar campus, navegar semanas y abrir fichas`, async ({page}) => {
    await page.clock.setFixedTime(new Date('2026-10-28T15:00:00Z'));
    await page.setViewportSize({width, height: 852});
    const calls: string[] = [];
    await page.route('**/api/v1/**', route => {
      const url = new URL(route.request().url());
      calls.push(url.pathname);
      return route.fulfill({json: url.searchParams.get('start') === '2026-10-26' ? fichas : []});
    });
    await page.goto('/agenda');
    await expect(page.locator('.agenda-card')).toHaveCount(3);
    await expect(page.locator('.public-agenda')).toHaveCSS('background-color', 'rgb(245, 246, 248)');
    await expect(page.locator('.agenda-card').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.getByRole('combobox', {name: 'Campus'}).selectOption('Santiago');
    await expect(page.locator('.agenda-card')).toHaveCount(2);
    await expect(page.getByRole('link').filter({has: page.getByRole('heading', {name: 'Miércoles Oración', exact: true})})).toHaveAttribute('href', '/ficha/oracion');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/agenda-clara-${width}.png`, fullPage: true});
    await page.getByRole('button', {name: 'Semana siguiente'}).click();
    await expect(page.getByText('No hay fichas publicadas de Santiago para esta semana')).toBeVisible();
    await page.getByRole('button', {name: 'Esta semana', exact: true}).click();
    await expect(page.locator('.agenda-card')).toHaveCount(2);
    await page.reload();
    await expect(page.getByRole('combobox', {name: 'Campus'})).toHaveValue('Santiago');
    await expect(page.locator('.agenda-card')).toHaveCount(2);
    expect(calls.every(path => path === '/api/v1/fichas/public/week')).toBe(true);
  });
}

test('agenda pública: permite reintentar una carga fallida', async ({page}) => {
  let failing = true;
  await page.route('**/api/v1/fichas/public/week**', route => failing
    ? route.fulfill({status: 503, json: {}}) : route.fulfill({json: []}));
  await page.goto('/agenda');
  await expect(page.getByRole('alert').filter({hasText: 'No pudimos cargar la agenda'})).toBeVisible();
  failing = false;
  await page.getByRole('button', {name: 'Reintentar'}).click();
  await expect(page.getByText('No hay fichas publicadas para esta semana')).toBeVisible();
});
