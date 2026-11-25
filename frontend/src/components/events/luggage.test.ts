import { describe, expect, it } from 'vitest';
import { bagCodeIn, bagLabel, bagQr, labelsHtml } from './luggage';

const bag = { code: '7K3Q9XHM', number: 2, total: 3, description: 'Maleta <negra>', ownerName: 'José Muñoz', campusName: 'Santiago', ticketName: 'General' };

describe('equipaje', () => {
  it('lee la etiqueta escaneada o escrita a mano', () => {
    expect(bagCodeIn(bagQr('7K3Q9XHM'))).toBe('7K3Q9XHM');
    expect(bagCodeIn('7k3q-9xhm')).toBe('7K3Q9XHM');
    expect(bagCodeIn('59b904e0-b55a-4363-b3db-dfe43d08f468')).toBeNull();
    expect(bagLabel('7K3Q9XHM')).toBe('7K3Q-9XHM');
  });

  it('arma una etiqueta por bolso con el tamaño de la impresora', () => {
    const { css, html } = labelsHtml([bag, { ...bag, code: 'AAAABBBB', number: 3, description: null }], 'Retiro AR Hombres', '62x100', { '7K3Q9XHM': 'data:qr1', AAAABBBB: 'data:qr2' });
    expect(css).toContain('@page{size:62mm 100mm;margin:0}');
    expect(html.match(/class="lbl"/g)).toHaveLength(2);
    expect(html).toContain('BOLSO 2 DE 3');
    expect(html).toContain('7K3Q-9XHM');
    expect(html).toContain('src="data:qr1"');
    // Lo escrito por el equipo se escapa.
    expect(html).toContain('Maleta &lt;negra&gt;');
    expect(labelsHtml([bag], 'R', 'letter', { '7K3Q9XHM': 'x' }).html).toContain('class="sheet"');
    expect(labelsHtml([{ ...bag, total: 1, number: 1 }], 'R', '102x51', { '7K3Q9XHM': 'x' }).html).toContain('BOLSO 1</div>');
  });
});
