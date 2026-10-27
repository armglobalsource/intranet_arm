import { test, expect, type Page, type Locator } from '@playwright/test';

test.use({ baseURL: process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3000', channel: process.env.FICHA_UI_BROWSER });

const url = '/dashboard/fichas-tecnicas/ui-fixture?edit=1';
const names = ['pastoral', 'produccion', 'streaming', 'horarios', 'escena', 'setList', 'outfit', 'media', 'voluntarios', 'anuncios'];
const makeRow = (id: string, label: string, order: number, value = 'María González') => ({ id, label, order, type: 'person', shared: true, required: false, values: { shared: value } });

async function fixture(page: Page, permissions = ['*']) {
  page.on('pageerror', error => console.error('Browser error:', error.message, error.stack));
  const user = { id: 1, firstName: 'Usuario', lastName: 'Demo', email: 'demo@example.test', permissions, role: { name: 'admin' }, status: 'active' };
  const sections = Object.fromEntries(names.map((name) => [name, { rows: [], revision: 0, isCompleted: false }]));
  sections.pastoral.rows = [makeRow('welcome', 'Bienvenida', 0), makeRow('preach', 'Predicación', 1), makeRow('prayer', 'Oración', 2)] as any;
  sections.produccion.rows = [makeRow('sound', 'Sonido', 0)] as any;
  sections.escena.rows = [makeRow('vio', 'VIO', 0), makeRow('left', 'Posición Izquierda', 1, 'María González Fernández'), makeRow('center', 'Posición Centro', 2, 'Carlos Rodríguez'), makeRow('right', 'Posición Derecha', 3, 'Andrés Martínez'), makeRow('piano', 'Piano', 4), makeRow('voice', 'Voz', 5)] as any;
  const ficha = { fichaId: 'ui-fixture', title: 'Encuentro de domingo', campusName: 'Santiago', campusId: '1', type: 'unico', date: '2026-10-25', encuentros: [{ id: 'unico', label: 'Encuentro', time: '11:00', color: '#6554C0' }], sections, published: true, completionStatus: {}, status: 'in_progress', hiddenSections: ['streaming', 'horarios', 'media', 'voluntarios', 'anuncios', 'outfit', 'setList'], sectionLayout: { left: ['pastoral', 'produccion', 'streaming', 'horarios'], right: ['worship', 'media', 'voluntarios', 'anuncios'] } };
  const writes: { path: string; body: any }[] = [];
  const manualPeople: { manualId: string; name: string; campusName: string }[] = [];
  const song = { cancionId: 'song-1', titulo: 'See the light', tonalidad: 'G', hasLetra: true, letra: 'Letra de prueba del equipo', revision: '2026-10-27T09:00:00.123456Z', usageCount: 1 };
  await page.addInitScript((user) => localStorage.setItem('auth-storage', JSON.stringify({ state: { user, accessToken: 'local-ui-fixture', isAuthenticated: true, needsProfileCompletion: false }, version: 0 })), user);
  // Every API call is intercepted. These tests never read or modify live data.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      if (path.endsWith('/canciones/song-1')) Object.assign(song, body, { revision: '2026-10-27T09:00:01.123456Z' });
      else if (path.includes('/sections/')) {
        const section = path.split('/').pop()!;
        Object.assign(sections[section], body, { revision: sections[section].revision + 1 });
      } else Object.assign(ficha, body);
    }
    if (path.endsWith('/people/manual') && route.request().method() === 'POST') manualPeople.push({ manualId: '86ae332e-7b26-41cf-94f0-352284b090d8', name: route.request().postDataJSON().name, campusName: 'Santiago' });
    const data = path.endsWith('/people/manual') ? manualPeople.at(-1) : path.endsWith('/canciones/song-1') ? song : path.endsWith('/canciones') ? (route.request().method() === 'POST' ? song : [song]) : path.endsWith('/changelog') ? [] : path.endsWith('/people') ? [...[{ userId: 10, name: 'Ana Pérez', campusName: 'Santiago' }, { userId: 11, name: 'Ana Pérez', campusName: 'Puente Alto' }], ...manualPeople].filter(p => p.name.toLowerCase().includes((new URL(route.request().url()).searchParams.get('search') ?? '').toLowerCase())) : path.includes('/fichas/ui-fixture') ? ficha
      : path.endsWith('/equipo-roster') ? { worship: [], tecnico: [], ninguno: [] }
      : path.endsWith('/auth/me') ? user : [];
    await route.fulfill({ json: data });
  });
  return { ficha, writes, song };
}

async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  const end = (await to.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1720, height: 1100 }); });

test('secciones PDF: mover con botones y arrastrar conserva el orden al recargar', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  const blocks = page.locator('.ficha-pdf-order > [data-block-id]');
  await expect(blocks.first()).toHaveAttribute('data-block-id', 'pastoral');
  await page.getByRole('button', { name: 'Bajar sección Encuentro · Plataforma' }).click();
  await expect.poll(() => writes.filter(w => w.body.sectionLayout).at(-1)?.body.sectionLayout.pdfOrder.indexOf('pastoral')).toBeGreaterThan(0);
  await expect(blocks.first()).toHaveAttribute('data-block-id', 'produccion');
  await page.reload();
  await expect(blocks.first()).toHaveAttribute('data-block-id', 'produccion');
  await drag(page, page.getByRole('button', { name: 'Mover sección Encuentro · Plataforma' }), page.getByRole('button', { name: 'Mover sección Equipo técnico' }));
  await expect(blocks.first()).toHaveAttribute('data-block-id', 'pastoral');
  await page.reload();
  await expect(blocks.first()).toHaveAttribute('data-block-id', 'pastoral');
  expect(writes.filter(w => w.body.sectionLayout).at(-1)?.body.sectionLayout.pdfOrder).toContain('streaming');
});

test('secciones PDF: flechas disponibles en móvil y orden persistente', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.getByRole('button', { name: 'Bajar sección Encuentro · Plataforma' }).click();
  await expect(page.locator('.ficha-pdf-order > [data-block-id]').first()).toHaveAttribute('data-block-id', 'produccion');
  await expect.poll(() => writes.some(w => Array.isArray(w.body.sectionLayout?.pdfOrder))).toBe(true);
  await page.reload();
  await expect(page.locator('.ficha-pdf-order > [data-block-id]').first()).toHaveAttribute('data-block-id', 'produccion');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('personas manuales: crear, asignar tratamiento y reutilizar en otra fila', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).click();
  await page.getByLabel('Buscar personas').fill('Eve');
  await page.getByRole('button', { name: 'Agregar «Eve» sin cuenta' }).click();
  await page.getByLabel('Tratamiento de Eve').fill('Pastora');
  await page.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect.poll(() => writes.find(w => w.path.endsWith('/sections/pastoral'))?.body.rows[0].values.shared).toBe('Pastora Eve');
  await page.getByRole('button', { name: 'Asignar personas: Predicación', exact: true }).click();
  await page.getByLabel('Buscar personas').fill('Eve');
  await expect(page.getByText('Persona sin cuenta', { exact: false })).toBeVisible();
  await page.getByRole('checkbox').last().check();
  await page.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect(page.getByRole('button', { name: 'Asignar personas: Predicación', exact: true })).toContainText('Eve');
});

test('filas: arrastrar, guardar y recargar conserva el nuevo orden', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  const pastoral = page.locator('[data-block-id="pastoral"]');
  await drag(page, pastoral.locator('[data-row-id="welcome"]').getByRole('button', { name: 'Mover fila' }), pastoral.locator('[data-row-id="prayer"]'));
  await expect.poll(() => writes.find((w) => w.path.endsWith('/sections/pastoral'))?.body.rows.map((r: any) => r.id)).toEqual(['preach', 'prayer', 'welcome']);
  await page.reload();
  await expect(pastoral.locator('[data-row-id]').first()).toHaveAttribute('data-row-id', 'preach');
  await expect(page.locator('.ficha-doc')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'test-results/ficha-clara-desktop.png', fullPage: true });
});

test('bloques: mover entre columnas persiste después de recargar', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  await page.getByRole('button', { name: 'Personalizar orden de bloques' }).click();
  await drag(page, page.getByRole('button', { name: 'Mover bloque Equipo Pastoral' }), page.getByRole('button', { name: 'Mover bloque AR Worship / Banda' }));
  await expect.poll(() => writes.find((w) => w.body.sectionLayout)?.body.sectionLayout.right).toContain('pastoral');
  await page.reload();
  await page.getByRole('button', { name: 'Personalizar orden de bloques' }).click();
  await expect(page.locator('.ficha-drop-column').nth(1).locator('[data-block-id="pastoral"]')).toBeVisible();
});

test('posiciones: arrastre horizontal conserva VIO y músicos; campo sin scroll', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  await drag(page, page.locator('[data-row-id="left"]').getByRole('button', { name: 'Mover fila' }), page.locator('[data-row-id="right"]'));
  await expect.poll(() => writes.find((w) => w.path.endsWith('/sections/escena'))?.body.rows.map((r: any) => r.id)).toEqual(['vio', 'center', 'right', 'left', 'piano', 'voice']);
  const cell = page.locator('[data-row-id="left"] .ficha-person-cell');
  await expect(cell).toContainText('María González Fernández');
  expect(await cell.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
});

test('vista móvil: agregar visible, sin desbordamiento y teclado para ordenar', async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const handle = page.locator('[data-row-id="welcome"]').getByRole('button', { name: 'Mover fila' });
  await handle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/ficha-clara-mobile.png', fullPage: true });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.locator('[data-row-id="preach"]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(0);
  await page.keyboard.press('Space');
  await expect(handle).not.toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-block-id="pastoral"] [data-row-id]').first()).toHaveAttribute('data-row-id', 'preach');
  await expect(page.locator('.ficha-add-row').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ficha-clara-mobile.png', fullPage: true });
});

test('solo lectura: no expone asas ni acciones de edición', async ({ page }) => {
  await fixture(page, ['fichas:view']);
  await page.goto(url);
  await expect(page.getByText('Encuentro de domingo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mover (fila|bloque)/ })).toHaveCount(0);
  await expect(page.locator('.ficha-add-row')).toHaveCount(0);
});

test('un fallo al guardar el bloque permite reintentar sin perder el orden elegido', async ({ page }) => {
  const { writes } = await fixture(page);
  let fail = true;
  await page.route('**/api/v1/fichas/ui-fixture', async (route) => {
    if (fail && route.request().method() === 'PATCH') {
      fail = false;
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fallback();
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Personalizar orden de bloques' }).click();
  await drag(page, page.getByRole('button', { name: 'Mover bloque Equipo Pastoral' }), page.getByRole('button', { name: 'Mover bloque AR Worship / Banda' }));
  await expect(page.getByText('No se pudo guardar el orden. Pulsa Guardar para reintentar.')).toBeVisible();
  await page.getByRole('button', { name: 'Error al guardar' }).click();
  await expect.poll(() => writes.find((w) => w.body.sectionLayout)?.body.sectionLayout.right).toContain('pastoral');
  await expect(page.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
});

test('impresión clara conserva contenido y oculta las asas', async ({ page }) => {
  await fixture(page);
  await page.goto(url);
  await expect(page.locator('[data-block-id="pastoral"]')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.ficha-doc')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: 'Mover fila' }).first()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Bienvenida', exact: true })).toBeVisible();
  await expect(page.getByText('Equipo de la ficha', { exact: true })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
  await page.pdf({ path: 'test-results/ficha-estructura.pdf', format: 'A4', printBackground: true });
});


test('personas: conserva dos homónimos por ID al guardar y recargar', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto(url);
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Dato anterior:', { exact: false })).toBeVisible();
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await dialog.getByLabel('Nota opcional').fill('Coordinación');
  await page.screenshot({ path: 'test-results/ficha-personas-selector.png' });
  await dialog.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/pastoral')).at(-1)?.body.rows[0].assignments?.shared?.people.map((p:any) => p.userId)).toEqual([10, 11]);
  await page.reload();
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).click();
  await expect(dialog.getByRole('checkbox').nth(0)).toBeChecked();
  await expect(dialog.getByRole('checkbox').nth(1)).toBeChecked();
  await dialog.getByRole('checkbox').nth(0).uncheck();
  await dialog.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/pastoral')).at(-1)?.body.rows[0].assignments?.shared?.people.map((p:any) => p.userId)).toEqual([11]);
});

test('selector móvil: cancelar conserva texto anterior; un recurso no crea usuarios', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tipo de asignación').selectOption('pending');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true })).toContainText('María González');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).click();
  await dialog.getByLabel('Tipo de asignación').selectOption('fixed');
  await dialog.getByLabel('Nota opcional').fill('Cámara 4');
  await page.screenshot({ path: 'test-results/ficha-personas-mobile.png' });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/pastoral')).at(-1)?.body.rows[0].values.shared).toBe('Fija · Cámara 4');
});


test('bloque AM: cambiar la asignación compartida conserva el encuentro PM', async ({ page }) => {
  const { ficha, writes } = await fixture(page);
  ficha.type = 'multi';
  ficha.encuentros = ['09:00', '11:00', '17:00'].map((time, i) => ({ id: `e${i}`, label: `Encuentro ${time}`, time, color: '#6554C0' }));
  await page.goto(url);
  await page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').nth(0).check();
  await expect(page.locator('.ficha-matrix-head')).toContainText('09:00');
  await expect(page.locator('.ficha-matrix-head')).toContainText('17:00');
  await dialog.getByLabel('Aplicar a').selectOption('block');
  await dialog.getByRole('button', { name: 'Aplicar asignación' }).click();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/pastoral')).at(-1)?.body.rows[0].values).toEqual({ e0: 'Ana Pérez', e1: 'Ana Pérez', e2: 'María González' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Asignar personas: Bienvenida', exact: true }).first()).toContainText('Ana Pérez');
});


test('estructura de referencia: secciones siguen el orden del PDF y conserva las asignaciones', async ({ page }) => {
  const { ficha } = await fixture(page);
  ficha.hiddenSections = [];
  await page.goto(url);
  await expect(page.locator('.ficha-pdf-order')).toBeVisible();
  await expect(page.locator('.ficha-pdf-order > [data-ficha-slot]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-ficha-slot')))).resolves.toEqual(['pastoral', 'streaming', 'produccion', 'media', 'anuncios', 'worship', 'horarios', 'voluntarios']);
  await expect(page.getByRole('button', { name: 'Asignar personas: Bienvenida' })).toBeVisible();
  await expect(page.locator('.ficha-worship-columns')).toHaveCSS('display', 'grid');
});


test('canciones: seleccionar carga el tono y permite guardar letra en catálogo privado', async ({ page }) => {
  const { ficha, writes, song } = await fixture(page);
  ficha.hiddenSections = ficha.hiddenSections.filter(s => s !== 'setList');
  ficha.sections.setList.rows = [{ id: 'songrow', label: 'Canción 1', order: 0, type: 'song', shared: false, required: false, values: {} }] as any;
  await page.goto(url);
  const input = page.getByPlaceholder('Nombre de la canción…').first();
  await input.fill('See the light');
  await expect(page.getByRole('button', { name: /See the light/ })).toBeVisible();
  await input.press('Enter');
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/setList')).at(-1)?.body.rows[0].values.unico).toContain('"tonalidad":"G"');
  await page.getByRole('button', { name: 'Letra y catálogo' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Letra de prueba del equipo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Editar catálogo' }).click();
  await dialog.getByLabel('Tono de referencia').fill('D');
  await dialog.locator('textarea').fill('Letra editada de prueba');
  await dialog.getByRole('button', { name: 'Guardar en catálogo' }).click();
  await expect(dialog.getByText('Letra editada de prueba')).toBeVisible();
  expect(song.tonalidad).toBe('D');
  await dialog.getByRole('button', { name: 'Usar tono en esta ficha' }).click();
  await expect.poll(() => writes.filter(w => w.path.endsWith('/sections/setList')).at(-1)?.body.rows[0].values.unico).toContain('"tonalidad":"D"');
  expect(writes.filter(w => w.path.endsWith('/sections/setList')).at(-1)?.body.rows[0].values.unico).not.toContain('Letra editada');
});


test('secciones: quitar y recuperar Timing conserva sus datos después de recargar', async ({ page }) => {
  const { ficha, writes } = await fixture(page);
  ficha.hiddenSections = ficha.hiddenSections.filter(s => s !== 'horarios');
  ficha.sections.horarios.rows = [{ id: 'h1', label: 'Inicio encuentro', order: 0, type: 'text', shared: false, required: false, values: { unico: JSON.stringify({ inicio: '11:00', nota: 'Abrir puertas' }) } }] as any;
  await page.goto(url);
  const timing = page.locator('[data-ficha-slot="horarios"]');
  await expect(timing).toContainText('Inicio encuentro');
  await timing.getByRole('button', { name: 'Quitar sección Timing' }).click();
  await expect(timing).toHaveCount(0);
  await expect.poll(() => writes.filter(w => Array.isArray(w.body.hiddenSections)).at(-1)?.body.hiddenSections).toContain('horarios');
  await page.reload();
  await expect(timing).toHaveCount(0);
  await page.getByText('Agregar o quitar secciones').click();
  await page.getByRole('button', { name: 'Agregar sección Timing' }).click();
  await expect(timing).toContainText('Inicio encuentro');
  await expect.poll(() => writes.filter(w => Array.isArray(w.body.hiddenSections)).at(-1)?.body.hiddenSections).not.toContain('horarios');
  await page.reload();
  await expect(timing).toContainText('Inicio encuentro');
  expect(ficha.sections.horarios.rows[0].values.unico).toContain('Abrir puertas');
});

test('secciones: los cambios rápidos se guardan en orden', async ({ page }) => {
  const { ficha, writes } = await fixture(page);
  ficha.hiddenSections = ficha.hiddenSections.filter(s => s !== 'horarios');
  let delayed = true;
  await page.route('**/api/v1/fichas/ui-fixture', async route => {
    if (route.request().method() === 'PATCH' && delayed && route.request().postDataJSON().hiddenSections) {
      delayed = false; await new Promise(resolve => setTimeout(resolve, 400));
    }
    await route.fallback();
  });
  await page.goto(url);
  await page.locator('[data-ficha-slot="horarios"]').getByRole('button', { name: 'Quitar sección Timing' }).click();
  await page.getByText('Agregar o quitar secciones').click();
  await page.getByRole('button', { name: 'Agregar sección Timing' }).click();
  await expect.poll(() => writes.filter(w => Array.isArray(w.body.hiddenSections)).length).toBe(2);
  expect(ficha.hiddenSections).not.toContain('horarios');
  await page.reload();
  await expect(page.locator('[data-ficha-slot="horarios"]')).toBeVisible();
});

test('secciones: si falla el guardado se restaura la vista y se informa', async ({ page }) => {
  const { ficha } = await fixture(page);
  ficha.hiddenSections = ficha.hiddenSections.filter(s => s !== 'horarios');
  await page.route('**/api/v1/fichas/ui-fixture', async route => {
    if (route.request().method() === 'PATCH' && route.request().postDataJSON().hiddenSections) return route.fulfill({ status: 503, json: {} });
    await route.fallback();
  });
  await page.goto(url);
  await page.locator('[data-ficha-slot="horarios"]').getByRole('button', { name: 'Quitar sección Timing' }).click();
  await expect(page.getByText('No se pudo actualizar la sección. Inténtalo nuevamente.')).toBeVisible();
  await expect(page.locator('[data-ficha-slot="horarios"]')).toBeVisible();
});
