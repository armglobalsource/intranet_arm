// Explicit model for the collections present in the verified production export.
// Camel-case fields retain the existing API vocabulary. Quoted SQL identifiers
// are required. Nested editorial content and historical snapshots remain JSONB.
const model = {};
function entity(name, groups) {
  const fields = {};
  for (const [type, names] of Object.entries(groups)) {
    for (const name of names.split(' ').filter(Boolean)) fields[name] = type;
  }
  model[name] = fields;
}
entity('roles', { bigint: 'id', text: 'name nameLower description', jsonb: 'permissions', boolean: 'isSystem isActive', timestamptz: 'createdAt updatedAt' });
entity('campuses', { bigint: 'id', text: 'name nameLower address fichaType siglas city country phone email website description', boolean: 'isActive', jsonb: 'encuentrosConfig schedules pastorIds adminIds asistenciaCategoriaKeys voluntarioCategoriaKeys monedaCodes', timestamptz: 'createdAt updatedAt' });
entity('job_titles', { bigint: 'id sortOrder', text: 'name nameLower', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('users', { bigint: 'id campusId roleId departmentId', text: 'firstName lastName nameLower email passwordHash ministerialTitle country avatarUrl status phone gender birthDate bio memberSince phoneCountryCode servingStatus preferredName referralChannel otherAreaText referredByName', jsonb: 'jobTitles campus role interestAreas', timestamptz: 'createdAt updatedAt lastLoginAt onboardingCompletedAt consentAcceptedAt' });
entity('org_areas', { bigint: 'id sortOrder', text: 'name slug desc color leaderDesc icon iconUrl', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('org_teams', { bigint: 'id areaId colPosition sortOrder', text: 'name desc iconUrl', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('org_memberships', { bigint: 'id userId areaId teamId sortOrder jobTitleId', text: 'role customTitle', timestamptz: 'createdAt updatedAt' });
entity('campus_administradores', { bigint: 'id campusId', text: 'tipo nombre', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('campus_equipos', { bigint: 'id campusId', text: 'tipo nombre modalidad', jsonb: 'administradorIds', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('campus_turnos', { bigint: 'id campusId equipoId', text: 'tipo modalidad equipoNombreSnapshot', date: 'fecha', boolean: 'isManualOverride', timestamptz: 'createdAt updatedAt' });
entity('canciones', { text: 'cancionId titulo tituloNorm tonalidad', bigint: 'usageCount', timestamptz: 'createdAt updatedAt' });
entity('content', { bigint: 'id campusId authorId', text: 'type body imageUrl status title excerpt', boolean: 'pinned', jsonb: 'mediaItems', timestamptz: 'createdAt updatedAt publishedAt' });
entity('disponibilidades', { bigint: 'id userId campusId', text: 'bloque hora dia weekLabel campusName nota scheduleKey userName', boolean: 'available', timestamptz: 'encounterDate createdAt updatedAt' });
entity('feedback', { bigint: 'id userId resolvedBy', text: 'userName userEmail type message screenshotUrl note resolvedByName status', timestamptz: 'createdAt updatedAt resolvedAt' });
entity('fichas', { text: 'fichaId campusName type title descripcion ubicacion createdByName status publishedByName lastModifiedByName archivedByName', bigint: 'campusId createdBy publishedBy lastModifiedBy archivedBy', jsonb: 'encuentros hiddenSections completionStatus sections sectionLayout layoutVisual', boolean: 'published archived', timestamptz: 'createdAt publishedAt date lastModifiedAt mediaMigratedAt archivedAt' });
entity('ficha_changelog', { bigint: 'userId', text: 'userName seccion', jsonb: 'cambios', timestamptz: 'timestamp' });
entity('notifications', { bigint: 'id userId', text: 'channel link body title', boolean: 'read', timestamptz: 'createdAt updatedAt readAt' });
entity('onboarding', { bigint: 'id', text: 'color emoji videoUrl welcomeTitle slug welcomeText teamName', jsonb: 'steps roleNames', boolean: 'isActive', timestamptz: 'createdAt updatedAt' });
entity('paletas', { text: 'id name', jsonb: 'colors', bigint: 'order', boolean: 'active', timestamptz: 'createdAt' });
entity('refresh_tokens', { bigint: 'id userId', text: 'tokenHash ipAddress userAgent', timestamptz: 'expiresAt revokedAt createdAt' });
entity('tipo_cambio', { text: 'moneda source', numeric: 'unitsPerUSD', jsonb: 'updatedBy', timestamptz: 'updatedAt' });
entity('tipo_cambio_meta', { timestamptz: 'lastRefreshedAt' });
entity('visual_references', { bigint: 'id uploadedBy usageCount', text: 'name imageUrl storageKey uploadedByName', jsonb: 'tags', boolean: 'isActive', timestamptz: 'uploadedAt' });

const references = {
  users: { campusId: 'campuses', roleId: 'roles' },
  org_teams: { areaId: 'org_areas' },
  org_memberships: { userId: 'users', areaId: 'org_areas', teamId: 'org_teams', jobTitleId: 'job_titles' },
  campus_administradores: { campusId: 'campuses' },
  campus_equipos: { campusId: 'campuses' },
  campus_turnos: { campusId: 'campuses', equipoId: 'campus_equipos' },
  content: { campusId: 'campuses', authorId: 'users' },
  disponibilidades: { campusId: 'campuses', userId: 'users' },
  feedback: { userId: 'users', resolvedBy: 'users' },
  fichas: { campusId: 'campuses', createdBy: 'users', publishedBy: 'users', lastModifiedBy: 'users', archivedBy: 'users' },
  ficha_changelog: { userId: 'users' },
  notifications: { userId: 'users' },
  refresh_tokens: { userId: 'users' },
  visual_references: { uploadedBy: 'users' },
};
module.exports = { model, references };
