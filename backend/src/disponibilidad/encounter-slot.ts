/** Encuentro de una semana para el que se pide disponibilidad (Worship y técnicos). */
export interface EncounterSlot {
  scheduleKey:   string;
  dia:           string;
  hora:          string;   // "09:00 · 11:00" cuando hay bloque con múltiples servicios
  bloque?:       string;   // "AM" | "PM" | cualquier etiqueta
  encounterDate: Date;
  fichaType?:    string;
}
