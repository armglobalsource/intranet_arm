import type { ServingStatus } from './user';

/** Valores usados tanto por el wizard de bienvenida como por la página de
 * perfil — deben coincidir exactamente con lo que ya está guardado en
 * Firestore (son strings libres, no un enum validado server-side). */

export const INVITED_VALUE = 'Invitación de una persona';

export const CHANNEL_OPTIONS = [
  { value: INVITED_VALUE,          label: 'Me invitó una persona'  },
  { value: 'Redes sociales',       label: 'Redes sociales'         },
  { value: 'YouTube',              label: 'Canal de YouTube'       },
  { value: 'Página web',           label: 'Página web'             },
  { value: 'Evento o actividad',   label: 'Evento o actividad'     },
  { value: 'Otro',                 label: 'Otro medio'             },
];

export const SERVING_OPTIONS: { value: ServingStatus; label: string }[] = [
  { value: 'yes',        label: 'Sí, actualmente sirvo'          },
  { value: 'not-now',    label: 'Serví anteriormente'            },
  { value: 'interested', label: 'Todavía no, pero me interesa'   },
  { value: 'no',         label: 'Por ahora no'                   },
];

export const OTHER_AREA_VALUE = 'Otros';
