import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityTask } from './AvailabilityTask';

const mocks = vi.hoisted(() => ({
  mine: vi.fn(), slots: vi.fn(), technicalMine: vi.fn(), technicalSlots: vi.fn(),
}));
vi.mock('@/hooks/useDisponibilidad', () => ({ useMyDisponibilidad: mocks.mine, useEncounters: mocks.slots }));
vi.mock('@/hooks/useTecnicos', () => ({ useMyTecnicosDisponibilidad: mocks.technicalMine, useTecnicosEncounters: mocks.technicalSlots }));
const result = (data: unknown[] = [], overrides = {}) => ({ data, isLoading: false, isError: false, refetch: vi.fn(), ...overrides });
const render = (campusId: number | null = 1) => renderToStaticMarkup(<AvailabilityTask campusId={campusId} channel="worship" />);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mine.mockReturnValue(result()); mocks.slots.mockReturnValue(result());
  mocks.technicalMine.mockReturnValue(result()); mocks.technicalSlots.mockReturnValue(result());
});
describe('AvailabilityTask', () => {
  it('does not call the unrelated channel with an enabled campus', () => {
    render();
    expect(mocks.mine.mock.calls[0][0]).toBe(1);
    expect(mocks.technicalMine.mock.calls[0][0]).toBeNull();
    expect(mocks.technicalSlots.mock.calls[0][0]).toBeNull();
  });
  it('guides users without a campus to their profile', () => {
    const html = render(null);
    expect(html).toContain('Revisar mi perfil');
    expect(html).not.toContain('Enviar disponibilidad');
  });
  it('does not show a failed or loading query as completed work', () => {
    mocks.mine.mockReturnValue(result([], { isError: true }));
    expect(render()).toContain('Reintentar');
    expect(render()).not.toContain('Respondiste todos');
    mocks.mine.mockReturnValue(result([], { isLoading: true }));
    expect(render()).toContain('Consultando disponibilidad');
  });
  it('counts unanswered encounters, including a negative answer as answered', () => {
    mocks.slots.mockReturnValue(result([{ scheduleKey: 'a' }, { scheduleKey: 'b' }]));
    mocks.mine.mockReturnValue(result([{ scheduleKey: 'a', available: false }]));
    expect(render()).toContain('1 encuentro sin responder');
    mocks.mine.mockReturnValue(result([{ scheduleKey: 'a', available: false }, { scheduleKey: 'b', available: true }]));
    expect(render()).toContain('Respondiste todos');
    expect(render()).toContain('no confirma una asignación');
  });
  it('shows no scheduled encounters without inventing a pending task', () => {
    expect(render()).toContain('Todavía no hay encuentros programados');
    expect(render()).not.toContain('Enviar disponibilidad');
  });
});
