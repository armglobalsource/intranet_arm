// Equipaje: tipos, lectura de etiquetas y la impresión de etiquetas con QR (sin React, para probarlo aparte).

export type Bag = {
  id: string; code: string; number: number; total: number; description: string | null; status: 'stored' | 'delivered' | 'void';
  registrationId: string; ownerName: string; ticketName: string | null; campusName: string; createdAt: string; createdBy: string | null;
  deliveredAt: string | null; deliveredBy: string | null; deliveredMethod: 'ticket' | 'id_check' | null;
};
export type LuggageCounts = { stored: number; delivered: number; owners: number };
export type LuggageOwner = { id: string; name: string; status: string; ticketName: string; campusName: string };
export type LuggageList = { event: { id: string; title: string; color?: string; timezone?: string; startsAt: string }; bags: Bag[]; counts: LuggageCounts };
export type DeliverReply = { result: 'ok' | 'mismatch' | 'already' | 'void' | 'not_found'; message: string; bag: Bag | null; counts: LuggageCounts };

/** «ARMEQ-7K3Q9XHM» (QR) o «7K3Q-9XHM» (escrito a mano) → «7K3Q9XHM». */
export function bagCodeIn(text: string) {
  const t = String(text ?? '').toUpperCase();
  const tagged = /ARMEQ-([A-Z0-9]{8})/.exec(t)?.[1];
  if (tagged) return tagged;
  const plain = t.replace(/[\s-]/g, '');
  return /^[A-Z0-9]{8}$/.test(plain) ? plain : null;
}
export const bagLabel = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
export const bagQr = (code: string) => `ARMEQ-${code}`;

/** Tamaños de etiqueta habituales. La impresora debe tener el mismo tamaño elegido en su configuración. */
export const LABEL_SIZES = {
  '62x100': { name: '62 × 100 mm (rollo continuo de 62 mm)', width: '62mm', height: '100mm', layout: 'tall' },
  '102x51': { name: '102 × 51 mm (4 × 2 pulgadas)', width: '102mm', height: '51mm', layout: 'wide' },
  '102x152': { name: '102 × 152 mm (4 × 6 pulgadas)', width: '102mm', height: '152mm', layout: 'tall' },
  letter: { name: 'Hoja carta (10 etiquetas para recortar)', width: '216mm', height: '279mm', layout: 'sheet' },
} as const;
export type LabelSize = keyof typeof LABEL_SIZES;
export const DEFAULT_LABEL: LabelSize = '62x100';
const SIZE_KEY = 'arm-luggage-label-size';
export function savedLabelSize(): LabelSize {
  try { const v = localStorage.getItem(SIZE_KEY); if (v && v in LABEL_SIZES) return v as LabelSize; } catch { /* sin almacenamiento */ }
  return DEFAULT_LABEL;
}
export function saveLabelSize(v: LabelSize) { try { localStorage.setItem(SIZE_KEY, v); } catch { /* sin almacenamiento */ } }

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** HTML de las etiquetas (una por bolso). `qr` recibe el código y entrega la imagen del QR (data URL). */
export function labelsHtml(bags: Pick<Bag, 'code' | 'number' | 'total' | 'description' | 'ownerName' | 'campusName' | 'ticketName'>[], eventTitle: string, size: LabelSize, qr: Record<string, string>) {
  const s = LABEL_SIZES[size];
  const label = (b: (typeof bags)[number]) => `
    <section class="lbl">
      <div class="ev">${esc(eventTitle)}</div>
      <div class="body">
        <img class="qr" src="${qr[b.code]}" alt="">
        <div class="txt">
          <div class="nm">${esc(b.ownerName)}</div>
          <div class="cp">${esc([b.campusName, b.ticketName].filter(Boolean).join(' · '))}</div>
          <div class="no">BOLSO ${b.number}${b.total > 1 ? ` DE ${b.total}` : ''}</div>
          ${b.description ? `<div class="ds">${esc(b.description)}</div>` : ''}
          <div class="cd">${esc(bagLabel(b.code))}</div>
        </div>
      </div>
    </section>`;
  const page = s.layout === 'sheet' ? `@page{size:letter;margin:8mm}` : `@page{size:${s.width} ${s.height};margin:0}`;
  const css = `${page}
  #luggage-print{display:none;font-family:Arial,Helvetica,sans-serif;color:#000}
  #luggage-print .lbl{box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;gap:2mm;padding:3mm;break-inside:avoid;page-break-inside:avoid}
  #luggage-print .ev{font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-bottom:.4mm solid #000;padding-bottom:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #luggage-print .body{display:flex;gap:3mm;flex:1;min-height:0}
  #luggage-print .qr{image-rendering:pixelated;flex:none}
  #luggage-print .txt{display:flex;flex-direction:column;gap:1mm;min-width:0}
  #luggage-print .nm{font-weight:800;line-height:1.05;overflow-wrap:anywhere}
  #luggage-print .cp,#luggage-print .ds{font-size:9pt}
  #luggage-print .no{font-weight:800;font-size:12pt;margin-top:auto}
  #luggage-print .cd{font-family:Consolas,Menlo,monospace;font-size:10pt;font-weight:700;letter-spacing:.08em}
  ${s.layout === 'tall' ? `#luggage-print .lbl{width:${s.width};height:${s.height};page-break-after:always;break-after:page}
  #luggage-print .body{flex-direction:column;align-items:center;text-align:center}
  #luggage-print .qr{width:44mm;height:44mm}
  #luggage-print .nm{font-size:${size === '102x152' ? '24pt' : '17pt'}}
  #luggage-print .no{margin-top:1mm}` : ''}
  ${s.layout === 'wide' ? `#luggage-print .lbl{width:${s.width};height:${s.height};page-break-after:always;break-after:page}
  #luggage-print .qr{width:36mm;height:36mm}
  #luggage-print .nm{font-size:15pt}` : ''}
  ${s.layout === 'sheet' ? `#luggage-print .sheet{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:50mm}
  #luggage-print .lbl{border:.3mm dashed #000;height:50mm}
  #luggage-print .qr{width:34mm;height:34mm}
  #luggage-print .nm{font-size:14pt}` : ''}
  #luggage-print .lbl:last-child{page-break-after:auto;break-after:auto}
  @media print{body>*:not(#luggage-print){display:none!important}#luggage-print{display:block!important}html,body{margin:0!important;padding:0!important;background:#fff!important}}`;
  const content = bags.map(label).join('');
  return { css, html: s.layout === 'sheet' ? `<div class="sheet">${content}</div>` : content };
}

/** Imprime las etiquetas con el diálogo del navegador. Con Chrome en modo «--kiosk-printing» sale directo a la impresora. */
export async function printLabels(bags: Parameters<typeof labelsHtml>[0], eventTitle: string, size: LabelSize) {
  if (!bags.length) return;
  const QR = await import('qrcode');
  const qr: Record<string, string> = {};
  for (const b of bags) qr[b.code] = await QR.toDataURL(bagQr(b.code), { width: 400, margin: 1, errorCorrectionLevel: 'M' });
  const { css, html } = labelsHtml(bags, eventTitle, size, qr);
  document.getElementById('luggage-print')?.remove();
  document.getElementById('luggage-print-style')?.remove();
  const style = Object.assign(document.createElement('style'), { id: 'luggage-print-style', textContent: css });
  const root = Object.assign(document.createElement('div'), { id: 'luggage-print', innerHTML: html });
  document.head.appendChild(style); document.body.appendChild(root);
  // Espera a que carguen las imágenes del QR antes de abrir el diálogo.
  await Promise.all(Array.from(root.querySelectorAll('img')).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  const cleanup = () => { root.remove(); style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 60_000);
}
