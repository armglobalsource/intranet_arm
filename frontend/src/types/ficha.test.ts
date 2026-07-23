import { describe, expect, it } from 'vitest';
import { completionPercent } from './ficha';

describe('completionPercent', () => {
  it('calcula el avance solo con las secciones visibles', () => {
    expect(completionPercent(
      { pastoral: true, produccion: false, streaming: false } as any,
      ['streaming'],
    )).toBe(50);
  });

  it('devuelve cero cuando no existen secciones visibles', () => {
    expect(completionPercent(
      { pastoral: true } as any,
      ['pastoral'],
    )).toBe(0);
  });
});
