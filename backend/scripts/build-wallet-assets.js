// Genera backend/src/event-management/event-wallet-assets.ts con las imágenes del pase de Apple Wallet
// (ícono y logo en blanco) a partir de los logos de frontend/public. Uso: node scripts/build-wallet-assets.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const pub = path.join(__dirname, '..', '..', 'frontend', 'public');
const read = (f) => PNG.sync.read(fs.readFileSync(path.join(pub, f)));

/** Reducción por promedio de área (con alfa premultiplicado), suficiente para logos planos. */
function resize(src, w, h) {
  const out = new PNG({ width: w, height: h });
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(y * sy); yy < Math.min(src.height, Math.ceil((y + 1) * sy)); yy++)
      for (let xx = Math.floor(x * sx); xx < Math.min(src.width, Math.ceil((x + 1) * sx)); xx++) {
        const i = (yy * src.width + xx) * 4, al = src.data[i + 3] / 255;
        r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++;
      }
    const o = (y * w + x) * 4;
    out.data[o] = a ? r / a : 0; out.data[o + 1] = a ? g / a : 0; out.data[o + 2] = a ? b / a : 0; out.data[o + 3] = Math.round((a / n) * 255);
  }
  return out;
}
/** Logo negro sobre transparente → blanco, para el fondo de color del pase. */
function white(png) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    // Si el logo no trae transparencia, la oscuridad del trazo se usa como opacidad.
    const lum = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    const alpha = png.data[i + 3] < 255 ? png.data[i + 3] : 255 - lum;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = 255; out.data[i + 3] = alpha;
  }
  return out;
}
const b64 = (png) => PNG.sync.write(png).toString('base64');

const icon = read('arm-brand-icon-180.png');
const logo = white(read('logo_ficha.png'));
const ratio = logo.width / logo.height;
const files = {
  'icon.png': b64(resize(icon, 29, 29)),
  'icon@2x.png': b64(resize(icon, 58, 58)),
  'icon@3x.png': b64(resize(icon, 87, 87)),
  'logo.png': b64(resize(logo, Math.round(30 * ratio), 30)),
  'logo@2x.png': b64(resize(logo, Math.round(60 * ratio), 60)),
  'logo@3x.png': b64(resize(logo, Math.round(90 * ratio), 90)),
};
const body = Object.entries(files).map(([k, v]) => `  '${k}': '${v}',`).join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'src', 'event-management', 'event-wallet-assets.ts'),
  `// Generado por scripts/build-wallet-assets.js: imágenes del pase de Apple Wallet (PNG en base64).\nexport const WALLET_IMAGES: Record<string, string> = {\n${body}\n};\n`);
console.log(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])));
