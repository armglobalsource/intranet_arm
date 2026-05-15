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
      create: 'Invitar nuevas personas',
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
  campus: {
    label: 'Campus',
    description: 'Cursos y material de capacitación',
    actions: {
      view:   'Acceder al campus',
      manage: 'Administrar cursos y contenido del campus',
    },
  },
  directory: {
    label: 'Directorio',
    description: 'Cargos y estructura organizacional',
    actions: {
      view:   'Ver el directorio de la empresa',
      manage: 'Administrar cargos y la estructura del directorio',
    },
  },
} as const;

export function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(required)) return true;
  const [resource] = required.split(':');
  return userPermissions.includes(`${resource}:*`);
}
