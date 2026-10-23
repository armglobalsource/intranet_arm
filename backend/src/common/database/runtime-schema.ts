import { SqlConnection } from './identity-sql';
export async function assertRuntimeSchema(db:SqlConnection) {
  const recovery=await db.query("SELECT to_regclass('arm_app.password_reset_tokens') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='arm_app' AND table_name='users' AND column_name='authVersion') AS ready");
  if(!recovery.rows[0]?.ready) throw new Error('Aplica password-recovery.sql antes de desplegar la recuperación de contraseña.');
  const required=['users','roles','notifications','refresh_tokens','revoked_tokens','campuses','job_titles','org_areas','org_teams','org_memberships','fichas','ficha_changelog','campus_administradores','campus_equipos','campus_turnos','disponibilidades','disponibilidades_tecnicos','arm_catalogos','onboarding','canciones','paletas','content','documents','feedback','visual_references','tipo_cambio','tipo_cambio_meta','encuentros','siembra','kiloamor','anuncios','events'];
  const result=await db.query('SELECT name FROM unnest($1::text[]) name WHERE to_regclass(\'arm_app.\'||name) IS NULL',[required]);
  if(result.rows.length)throw new Error(`Faltan tablas PostgreSQL: ${result.rows.map(r=>r.name).join(', ')}. Aplica las migraciones antes de desplegar.`);
}
