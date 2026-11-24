// El escáner de la puerta lee un QR real: el navegador usa una cámara falsa que muestra
// el código de una entrada (generado con la misma librería que el correo y la página).
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import QRCode from 'qrcode';

const ticket = '4cf1c2a8-0d5e-4f7e-9a51-6a1b2c3d4e5f';
const eventId = '59b904e0-b55a-4363-b3db-dfe43d08f468';
const video = resolve('test-results/qr-camera.y4m');

/** Video Y4M (escala de grises) con el QR centrado sobre fondo blanco. */
function writeCamera() {
  const qr = QRCode.create(ticket, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size, W = 640, H = 480, cell = 10, quiet = 4;
  const side = (size + quiet * 2) * cell, x0 = (W - side) / 2, y0 = (H - side) / 2;
  const y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!qr.modules.get(r, c)) continue;
    for (let dy = 0; dy < cell; dy++) y.fill(16, (y0 + (r + quiet) * cell + dy) * W + x0 + (c + quiet) * cell, (y0 + (r + quiet) * cell + dy) * W + x0 + (c + quiet + 1) * cell);
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma]);
  mkdirSync('test-results', { recursive: true });
  writeFileSync(video, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(frame)]));
}
writeCamera();

test.use({
  baseURL: 'http://localhost:3005', channel: 'msedge',
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] },
  permissions: ['camera'],
});

test('la cámara lee el QR de la entrada y registra el ingreso', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth-storage', JSON.stringify({ version: 0, state: { user: { id: 1, campusId: 10, firstName: 'Prueba', lastName: 'ARM', permissions: ['eventos:checkin'], role: { name: 'user' }, status: 'active' }, accessToken: 'fixture', isAuthenticated: true } })));
  const person = { id: ticket, firstName: 'José', lastName: 'Muñoz', email: 'jose@example.com', phone: '', age: null, campusId: 10, campusName: 'Santiago', ticketName: 'General', status: 'confirmed', amount: 0, currency: 'CLP', source: 'public', createdAt: '2026-11-22T10:00:00Z', checkedInAt: null as string | null, checkedInBy: null as string | null };
  const codes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/attendees')) return route.fulfill({ json: { event: { id: eventId, slug: 'retiro', title: 'Retiro de Hombres', status: 'published', startsAt: '2027-01-10T12:00:00Z', endsAt: '2027-01-10T21:00:00Z', capacity: 50, timezone: 'America/Santiago', tickets: [], campuses: [{ id: 10, name: 'Santiago' }] }, manage: false, registrations: [person] } });
    if (path.endsWith('/check-in')) {
      codes.push(route.request().postDataJSON().code);
      const first = !person.checkedInAt;
      Object.assign(person, { checkedInAt: person.checkedInAt ?? '2027-01-10T22:42:00Z', checkedInBy: 'Prueba ARM' });
      return route.fulfill({ json: { result: first ? 'ok' : 'already', message: '', attendee: person, counts: { confirmed: 1, checkedIn: 1 } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`/dashboard/eventos/${eventId}/acceso`);
  await page.getByRole('button', { name: 'Activar cámara' }).click();
  await expect(page.getByRole('heading', { name: 'Puede entrar' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('José Muñoz', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/event-door-camera-393.png' });
  // El mismo QR sigue frente a la cámara: no se registra dos veces seguidas.
  await page.waitForTimeout(3000);
  expect(codes).toEqual([ticket]);
  // La barra del contador llega al 100 %.
  const bar = await page.locator('[class*=counter] [class*=meter] i').evaluate((el) => [el.getBoundingClientRect().width, el.parentElement!.getBoundingClientRect().width]);
  expect(bar[0]).toBeCloseTo(bar[1], 0);
});
