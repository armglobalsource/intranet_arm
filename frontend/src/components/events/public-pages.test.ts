import { describe, expect, it } from 'vitest';
import { priceLabel, statusLabel } from './EventPublicPages';
import { selfServiceNote } from './ReceiptActions';

describe('Catálogo y autogestión', () => {
  it('muestra el precio como gratis, valor único o «desde»', () => {
    expect(priceLabel({ pricing: 'free', minPrice: null, maxPrice: null })).toBe('Gratis');
    expect(priceLabel({ pricing: 'paid', minPrice: 8000, maxPrice: 8000 })).toMatch(/^\$8\.000$/);
    expect(priceLabel({ pricing: 'paid', minPrice: 8000, maxPrice: 12000 })).toMatch(/^Desde \$8\.000$/);
  });
  it('indica si quedan cupos o si la inscripción aún no abre', () => {
    expect(statusLabel({ registrationEnabled: true, soldOut: false }).text).toBe('Inscripciones abiertas');
    expect(statusLabel({ registrationEnabled: true, soldOut: true }).text).toBe('Cupos agotados');
    expect(statusLabel({ registrationEnabled: false, soldOut: false }).text).toBe('Inscripciones próximamente');
  });
  it('explica hasta cuándo se puede transferir o cancelar', () => {
    const until = '2027-01-09T15:00:00Z';
    expect(selfServiceNote({ transfer: true, cancel: true, until, open: true }, 'America/Santiago')).toBe('Puedes transferir o cancelar tus entradas hasta el sábado, 9 de enero, 12:00 hrs.');
    expect(selfServiceNote({ transfer: true, cancel: false, until, open: false })).toBe('El plazo para transferir entradas terminó.');
    expect(selfServiceNote({ transfer: false, cancel: false, until, open: true })).toBe('');
  });
});
