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
  encuentros: {
    label: 'Encuentros',
    description: 'Registro de servicios: asistencia, voluntarios y decisiones',
    actions: {
      view:   'Ver los registros de encuentros',
      create: 'Registrar nuevos encuentros',
      edit:   'Editar encuentros existentes',
      delete: 'Eliminar encuentros',
    },
  },
  siembra: {
    label: 'Siembra',
    description: 'Registro de ofrendas y diezmos por campus',
    actions: {
      view:   'Ver los registros de siembra',
      create: 'Registrar nueva siembra',
      edit:   'Editar registros de siembra',
      delete: 'Eliminar registros de siembra',
    },
  },
  kiloamor: {
    label: 'Kilo de Amor',
    description: 'Registro de cajas de donación de alimentos',
    actions: {
      view:   'Ver los registros de Kilo de Amor',
      create: 'Registrar nuevas cajas',
      edit:   'Editar registros',
      delete: 'Eliminar registros',
    },
  },
  anuncios: {
    label: 'Anuncios',
    description: 'Anuncios a miembros por campus (con notificación push)',
    actions: {
      view:   'Ver los anuncios',
      create: 'Publicar anuncios',
      edit:   'Editar y desactivar anuncios',
      delete: 'Eliminar anuncios',
    },
  },
  'arm-dashboard': {
    label: 'Dashboard ARM',
    description: 'Analítica y reportes de operaciones de campus',
    actions: {
      view: 'Ver el dashboard de ARM',
    },
  },
  estadisticas: {
    label: 'Estadísticas',
    description: 'Panel de estadísticas operativas de campus',
    actions: {
      view:    'Ver estadísticas del campus asignado',
      viewAll: 'Ver estadísticas y comparaciones de todos los campus',
    },
  },
  'arm-catalogos': {
    label: 'Configuración APP Web',
    description: 'Categorías de asistencia, voluntarios y monedas usadas en encuentros y siembra',
    actions: {
      view:   'Ver los catálogos de ARM',
      manage: 'Crear, modificar y eliminar entradas de catálogo',
    },
  },
} as const;

export type PermissionResource = keyof typeof PERMISSION_CATALOG;
export type Permission = `${PermissionResource}:${string}`;

/** Comprueba si un array de permisos cubre el permiso requerido. */
export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;

  // Wildcard por recurso: 'orgchart:*'
  const [resource] = required.split(':');
  return userPermissions.includes(`${resource}:*`);
}
