export const PERMISSION_CATALOG = {
  orgchart: {
    label: 'Organigrama',
    description: 'Estructura de áreas y equipos de la empresa',
    actions: {
      view:   'Ver el organigrama',
      edit:   'Agregar y modificar áreas, equipos y personas',
      delete: 'Eliminar áreas y equipos',
    },
  },
  users: {
    label: 'Personas',
    description: 'Cuentas de acceso de los colaboradores',
    actions: {
      view:   'Ver la lista de personas',
      create: 'Crear nuevas personas',
      edit:   'Modificar datos de una persona',
      delete: 'Dar de baja una persona',
    },
  },
  roles: {
    label: 'Roles y permisos',
    description: 'Qué puede hacer cada tipo de usuario',
    actions: {
      view:   'Ver los roles existentes',
      manage: 'Crear, modificar y eliminar roles',
    },
  },
  content: {
    label: 'Contenido',
    description: 'Noticias, anuncios y publicaciones internas',
    actions: {
      view:    'Leer contenido publicado',
      create:  'Redactar nuevo contenido',
      publish: 'Publicar y despublicar contenido',
      delete:  'Eliminar contenido',
    },
  },
  documents: {
    label: 'Documentos',
    description: 'Archivos y recursos compartidos',
    actions: {
      view:   'Descargar y ver documentos',
      upload: 'Subir nuevos documentos',
      delete: 'Eliminar documentos',
    },
  },
  areas: {
    label: 'Áreas',
    description: 'Ministerios y departamentos del organigrama',
    actions: {
      view:   'Ver las áreas',
      create: 'Crear nuevas áreas',
      edit:   'Modificar áreas existentes',
      delete: 'Eliminar áreas',
    },
  },
  equipos: {
    label: 'Equipos',
    description: 'Grupos de trabajo dentro de cada área',
    actions: {
      view:   'Ver los equipos',
      create: 'Crear nuevos equipos',
      edit:   'Modificar equipos existentes',
      delete: 'Eliminar equipos',
    },
  },
  campus: {
    label: 'Campus',
    description: 'Sedes y campus de la iglesia',
    actions: {
      view:   'Ver los campus',
      create: 'Crear nuevos campus',
      edit:   'Modificar campus existentes',
      delete: 'Eliminar campus',
    },
  },
  cargos: {
    label: 'Cargos',
    description: 'Catálogo de puestos del ministerio',
    actions: {
      view:   'Ver los cargos',
      create: 'Crear nuevos cargos',
      edit:   'Modificar cargos existentes',
      delete: 'Eliminar cargos',
    },
  },
  fichas: {
    label: 'Fichas Técnicas',
    description: 'Fichas técnicas de producción musical',
    actions: {
      view:    'Ver fichas propias',
      viewAll: 'Ver fichas de todos los usuarios',
      create:  'Crear nuevas fichas',
      edit:    'Editar fichas existentes',
      delete:  'Eliminar fichas',
      admin:   'Administrar configuración de fichas',
    },
  },
  // Recursos de solo-vista, sin endpoint de backend que proteger —
  // gatean únicamente la navegación del menú (mismo patrón que ya usan
  // "Adm. Campus" y "Soporte", que solo redirigen del lado del cliente).
  ministerio_ar_kids:    { label: 'AR Kids',      description: 'Página del ministerio AR Kids',      actions: { view: 'Ver la página de AR Kids' } },
  ministerio_ar_tweens:  { label: 'AR Tweens',    description: 'Página del ministerio AR Tweens',    actions: { view: 'Ver la página de AR Tweens' } },
  ministerio_ar_teens:   { label: 'AR Teens',     description: 'Página del ministerio AR Teens',     actions: { view: 'Ver la página de AR Teens' } },
  ministerio_ar_jovenes: { label: 'AR Jóvenes',   description: 'Página del ministerio AR Jóvenes',   actions: { view: 'Ver la página de AR Jóvenes' } },
  ministerio_ar_worship: { label: 'AR Worship',   description: 'Página del ministerio AR Worship',   actions: { view: 'Ver la página de AR Worship' } },
  ministerio_ar_hombres: { label: 'AR Hombres',   description: 'Página del ministerio AR Hombres',   actions: { view: 'Ver la página de AR Hombres' } },
  ministerio_ar_mujeres: { label: 'AR Mujeres',   description: 'Página del ministerio AR Mujeres',   actions: { view: 'Ver la página de AR Mujeres' } },
  ministerio_ar_gold:    { label: 'AR Gold',      description: 'Página del ministerio AR Gold',      actions: { view: 'Ver la página de AR Gold' } },
  estadisticas:          { label: 'Estadísticas', description: 'Panel de estadísticas de producción general', actions: { view: 'Ver el panel de estadísticas' } },
} as const;

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  const [resource] = required.split(':');
  return userPermissions.includes(`${resource}:*`);
}

// ── UI: agrupación por menú + modelo simplificado Ver/Editar ──────────────
// Metadata puramente de presentación — no cambia los strings resource:action
// que se guardan en Firestore, solo cómo se agrupan y muestran en el panel
// de permisos.

export interface PermissionUiSection {
  breadcrumb:  string[];
  viewActions: string[];
  editActions: string[];
  extra?: { key: string; label: string; actions: string[] }[];
}

export const PERMISSION_UI_CONFIG: Record<string, PermissionUiSection> = {
  orgchart:  { breadcrumb: ['Organigrama'],                          viewActions: ['view'], editActions: ['edit', 'delete'] },
  users:     { breadcrumb: ['Configuración', 'Personas'],            viewActions: ['view'], editActions: ['create', 'edit', 'delete'] },
  roles:     { breadcrumb: ['Configuración', 'Roles del Sistema'],   viewActions: ['view'], editActions: ['manage'] },
  areas:     { breadcrumb: ['Configuración', 'Áreas'],               viewActions: ['view'], editActions: ['create', 'edit', 'delete'] },
  equipos:   { breadcrumb: ['Configuración', 'Equipos'],             viewActions: ['view'], editActions: ['create', 'edit', 'delete'] },
  campus:    { breadcrumb: ['Configuración', 'Campus'],              viewActions: ['view'], editActions: ['create', 'edit', 'delete'] },
  cargos:    { breadcrumb: ['Configuración', 'Cargos'],              viewActions: ['view'], editActions: ['create', 'edit', 'delete'] },
  fichas:    {
    breadcrumb: ['Producción General', 'Fichas Técnicas'],
    viewActions: ['view'], editActions: ['create', 'edit', 'delete'],
    extra: [
      { key: 'viewAll', label: 'Ver fichas de todos los usuarios',      actions: ['viewAll'] },
      { key: 'admin',   label: 'Administrar configuración de fichas',   actions: ['admin'] },
    ],
  },
  content:   { breadcrumb: ['Producción General', 'Noticias'],       viewActions: ['view'], editActions: ['create', 'publish', 'delete'] },
  documents: { breadcrumb: [],                                       viewActions: ['view'], editActions: ['upload', 'delete'] },
  ministerio_ar_kids:    { breadcrumb: ['Ministerios', 'AR Kids'],      viewActions: ['view'], editActions: [] },
  ministerio_ar_tweens:  { breadcrumb: ['Ministerios', 'AR Tweens'],    viewActions: ['view'], editActions: [] },
  ministerio_ar_teens:   { breadcrumb: ['Ministerios', 'AR Teens'],     viewActions: ['view'], editActions: [] },
  ministerio_ar_jovenes: { breadcrumb: ['Ministerios', 'AR Jóvenes'],   viewActions: ['view'], editActions: [] },
  ministerio_ar_worship: { breadcrumb: ['Ministerios', 'AR Worship'],   viewActions: ['view'], editActions: [] },
  ministerio_ar_hombres: { breadcrumb: ['Ministerios', 'AR Hombres'],   viewActions: ['view'], editActions: [] },
  ministerio_ar_mujeres: { breadcrumb: ['Ministerios', 'AR Mujeres'],   viewActions: ['view'], editActions: [] },
  ministerio_ar_gold:    { breadcrumb: ['Ministerios', 'AR Gold'],      viewActions: ['view'], editActions: [] },
  estadisticas:          { breadcrumb: ['Producción General', 'Estadísticas'], viewActions: ['view'], editActions: [] },
};
