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
  fichas: {
    label: 'Fichas técnicas',
    description: 'Planificación y seguimiento de servicios y eventos',
    actions: {
      admin:  'Crear y eliminar fichas',
      create: 'Crear nuevas fichas',
      view:   'Ver fichas y sus secciones',
    },
  },
  events: {
    label: 'Eventos',
    description: 'Calendario de eventos de la organización',
    actions: {
      view:   'Ver el calendario de eventos',
      manage: 'Crear, editar y eliminar eventos',
    },
  },
  canciones: {
    label: 'Catálogo de canciones',
    description: 'Biblioteca de canciones para los servicios',
    actions: {
      view:   'Buscar canciones',
      manage: 'Agregar y modificar canciones',
    },
  },
} as const;

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  const [resource] = required.split(':');
  return userPermissions.includes(`${resource}:*`);
}
