// Roles y permisos dentro de una ficha (pedido por Producción):
//   - Productor General (fichas:admin): control completo de todas las fichas.
//   - Quien tiene fichas:edit en el campus: control completo de las fichas de su campus.
//   - Encargado Técnico de la ficha: responde por ella, edita todo su contenido,
//     publica y designa al Responsable de Actualización.
//   - Responsable de Actualización: designado por el Encargado; edita el contenido.
//   - Responsable de un área (assignedTo de la sección): edita solo esa sección.
//   - Responsable global de visuales (fichas:layout): edita el Layout Visual en todos los campus.
//   - El resto (Productor del Encuentro, otros equipos): consulta la ficha publicada.
// Publicar exige su propio permiso (fichas:publish) o ser el Encargado Técnico.

import { hasPermission } from '../common/permissions';

export interface FichaUser { sub: number; email: string; campusId?: number | null; permissions?: string[] }
export interface FichaPerson { userId: number; name: string }
export interface FichaEquipo { encargadoTecnico?: FichaPerson | null; responsableActualizacion?: FichaPerson | null }

export type FichaRole = 'productor' | 'editor' | 'encargado' | 'responsable' | 'area' | 'visuales' | 'lector';

export interface FichaPermisos {
  /** Rol principal del usuario en esta ficha, para mostrarlo. */
  rol: FichaRole;
  view: boolean;
  /** Encuentros, módulos, orden, título, fecha, archivar y eliminar. */
  structure: boolean;
  /** Todas las secciones. */
  content: boolean;
  /** Secciones que puede editar. */
  sections: string[];
  layoutVisual: boolean;
  publish: boolean;
  designateEncargado: boolean;
  designateResponsable: boolean;
}

export function fichaPermisos(f: any, u: FichaUser): FichaPermisos {
  const perms = u.permissions ?? [];
  const can = (p: string) => hasPermission(perms, p);
  const sameCampus = u.campusId != null && String(f.campusId) === String(u.campusId);
  const equipo: FichaEquipo = f.equipo ?? {};
  // Los ids pueden venir como número o texto según quién guardó la ficha.
  const me = (id: unknown) => id != null && String(id) === String(u.sub);
  const isEncargado = me(equipo.encargadoTecnico?.userId);
  const isResponsable = me(equipo.responsableActualizacion?.userId);
  const admin = can('fichas:admin');
  const structure = admin || (can('fichas:edit') && sameCampus);
  const content = structure || isEncargado || isResponsable;
  const allSections = Object.keys(f.sections ?? {});
  const own = allSections.filter((name) => me(f.sections[name]?.assignedTo));
  const sections = content ? allSections : own;
  const visuales = can('fichas:layout');
  const layoutVisual = content || visuales;
  const editsSomething = content || sections.length > 0 || layoutVisual;
  // Quien no edita nada consulta solo la ficha publicada.
  const reader = can('fichas:viewAll') || sameCampus;
  const view = admin || editsSomething || me(f.createdBy) || (reader && !!f.published);
  const rol: FichaRole = admin ? 'productor' : structure ? 'editor' : isEncargado ? 'encargado'
    : isResponsable ? 'responsable' : own.length ? 'area' : visuales ? 'visuales' : 'lector';
  return {
    rol, view, structure, content, sections, layoutVisual,
    publish: admin || (can('fichas:publish') && sameCampus) || isEncargado,
    designateEncargado: structure,
    designateResponsable: structure || isEncargado,
  };
}
