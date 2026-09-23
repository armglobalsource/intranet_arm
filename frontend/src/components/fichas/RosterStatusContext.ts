import { createContext, useContext } from 'react';
import type { RosterStatus } from '@/types/disponibilidad';

/** userId → estado de disponibilidad para la semana de la ficha actual */
export const RosterStatusContext = createContext<Record<number, RosterStatus>>({});

export function useRosterStatus() {
  return useContext(RosterStatusContext);
}
