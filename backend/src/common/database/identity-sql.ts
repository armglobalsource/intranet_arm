import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryResult } from 'pg';

export interface SqlConnection { query(text: string, values?: any[]): Promise<QueryResult>; }

// Keep BIGINT IDs numeric in the existing API, without changing pg globally.
export function apiRows(result: QueryResult): any[] {
  return result.rows.map(row => {
    const value = { ...row };
    for (const field of result.fields ?? []) {
      if (field.dataTypeID === 1082 && value[field.name] instanceof Date) {
        const date = value[field.name] as Date;
        value[field.name] = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      }
      if (field.dataTypeID === 20 && value[field.name] != null) {
        const n = Number(value[field.name]);
        if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds API precision');
        value[field.name] = n;
      }
    }
    if (value.document_id !== undefined) value.fichaId = value.document_id;
    delete value.document_id;
    for (const key of Object.keys(value)) if (key.startsWith('source_')) delete value[key];
    return value;
  });
}

export function databaseError(error: any): never {
  if (error?.code === '23505') throw new ConflictException('Ya existe un registro con esos datos');
  if (error?.code === '23503') throw new ConflictException('La operación tiene referencias relacionadas o inválidas');
  if (['23502', '23514', '22P02'].includes(error?.code)) throw new BadRequestException('Datos inválidos');
  throw error;
}

// Only reviewed identity tables/columns may be used to build identifiers.
const columns = {
  visual_references: new Set('name tags imageUrl storageKey uploadedBy uploadedByName uploadedAt usageCount isActive'.split(' ')),
  content: new Set('title body excerpt type pinned campusId status imageUrl videoUrl instagramUrl mediaItems authorId publishedAt createdAt updatedAt'.split(' ')),
  documents: new Set('name description departmentId minRoleId uploadedBy status createdAt updatedAt'.split(' ')),
  org_areas: new Set('slug name color icon iconUrl desc leaderDesc sortOrder isActive createdAt updatedAt'.split(' ')),
  org_teams: new Set('areaId parentTeamId name icon iconUrl desc colPosition sortOrder isActive createdAt updatedAt'.split(' ')),
  org_memberships: new Set('userId areaId teamId role jobTitleId customTitle sortOrder createdAt updatedAt'.split(' ')),
  campuses: new Set('name nameLower siglas address city country phone email website description pastorIds adminIds schedules asistenciaCategoriaKeys voluntarioCategoriaKeys monedaCodes isActive fichaType encuentrosConfig createdAt updatedAt'.split(' ')),
  job_titles: new Set('name nameLower sortOrder isActive createdAt updatedAt'.split(' ')),
  arm_catalogos: new Set('tipo key keyLower label sortOrder isActive createdAt updatedAt'.split(' ')),
  onboarding: new Set('teamName slug welcomeTitle welcomeText videoUrl emoji color roleNames steps isActive createdAt updatedAt'.split(' ')),
  feedback: new Set('userId userName userEmail type message screenshotUrl status note createdAt updatedAt resolvedAt resolvedBy resolvedByName'.split(' ')),
  campus_administradores: new Set('campusId tipo nombre isActive createdAt updatedAt'.split(' ')),
  campus_equipos: new Set('campusId tipo nombre administradorIds modalidad isActive createdAt updatedAt'.split(' ')),
  campus_turnos: new Set('campusId tipo fecha equipoId modalidad equipoNombreSnapshot isManualOverride createdAt updatedAt'.split(' ')),
  users: new Set('email passwordHash firstName lastName nameLower roleId campusId jobTitles phone country bio birthDate ministerialTitle avatarUrl status departmentId lastLoginAt createdAt updatedAt gender memberSince preferredName phoneCountryCode referralChannel referredByName servingStatus interestAreas otherAreaText onboardingCompletedAt consentAcceptedAt'.split(' ')),
  roles: new Set('name nameLower description isSystem isActive permissions createdAt updatedAt'.split(' ')),
  notifications: new Set('userId title body link channel read readAt createdAt updatedAt'.split(' ')),
};
type IdentityTable = keyof typeof columns;
const jsonFields = new Set(['tags','mediaItems','jobTitles','interestAreas','permissions','pastorIds','adminIds','schedules','asistenciaCategoriaKeys','voluntarioCategoriaKeys','monedaCodes','encuentrosConfig','roleNames','steps','administradorIds']);

export async function deleteIdentity(db: SqlConnection, table: IdentityTable, id: number) {
  if (!Object.prototype.hasOwnProperty.call(columns,table)) throw new Error('Unapproved SQL table');
  try {
    const result=await db.query(`DELETE FROM arm_app.${table} WHERE id=$1`,[id]);
    if(!result.rowCount) throw new NotFoundException('Registro no encontrado');
    return {id};
  } catch(error) {databaseError(error);}
}

function entries(table: IdentityTable, data: Record<string, any>) {
  return Object.entries(data).filter(([,value]) => value !== undefined).map(([key,value]) => {
    if (!columns[table].has(key)) throw new Error('Unapproved SQL column');
    return [key, jsonFields.has(key) && value != null ? JSON.stringify(value) : value] as const;
  });
}

export async function insertIdentity(db: SqlConnection, table: IdentityTable, data: Record<string, any>) {
  const fields = entries(table,data);
  try {
    const result = await db.query(`WITH identity AS (SELECT nextval(pg_get_serial_sequence('arm_app.${table}','id')) AS id)
      INSERT INTO arm_app.${table}(id,document_id,${fields.map(([k])=>`"${k}"`).join(',')})
      SELECT id,id::text,${fields.map((_,i)=>`$${i+1}`).join(',')} FROM identity RETURNING *`,fields.map(([,v])=>v));
    return apiRows(result)[0];
  } catch (error) { databaseError(error); }
}

export async function updateIdentity(db: SqlConnection, table: IdentityTable, id: number, data: Record<string, any>) {
  const fields = entries(table,data);
  if (!fields.length) throw new BadRequestException('No hay campos para actualizar');
  try {
    const result = await db.query(`UPDATE arm_app.${table} SET ${fields.map(([k],i)=>`"${k}"=$${i+2}`).join(',')}
      WHERE id=$1 RETURNING *`,[id,...fields.map(([,v])=>v)]);
    if (!result.rowCount) throw new NotFoundException('Registro no encontrado');
    return apiRows(result)[0];
  } catch(error) { databaseError(error); }
}
