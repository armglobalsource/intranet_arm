import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { hasPermission } from '../common/permissions';
import { MailDetailsDto } from './mail.dto';

export const DOMAINS = { arm: 'armglobal.org', school: 'arschoolglobal.com' } as const;
export const APPROVER_EMAIL = 'pburgos@armglobal.org';
export interface MailActor { sub: number; permissions: string[]; email?: string }
export const managesMail = (u: MailActor) => hasPermission(u.permissions, 'institutional-mail:manage');
export const approvesMail = (u: MailActor) => u.email?.trim().toLowerCase() === APPROVER_EMAIL && hasPermission(u.permissions, 'institutional-mail:approve');
export const identityKey = (s: string) => s.normalize('NFKC').replace(/[.\s-]/g, '').toUpperCase();
export const corporateEmail = (s: string) => /^[a-z0-9][a-z0-9._-]*@(armglobal\.org|arschoolglobal\.com)$/.test(s);
function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }

export function validateDetails(d: MailDetailsDto) {
  for (const key of ['name','employeeId','area','jobTitle','groups'] as const) if (!d[key]?.trim()) throw new BadRequestException('Completa los datos del colaborador y sus accesos.');
  if (!validDate(d.startsOn)) throw new BadRequestException('Indica una fecha válida.');
  if (!identityKey(d.employeeId)) throw new BadRequestException('Indica el RUT o ID de colaborador.');
  if (d.operation === 'create' && !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(d.suggestedName)) throw new BadRequestException('El nombre sugerido debe usar letras minúsculas, números, puntos o guiones.');
  if (d.kind === 'functional' && (!d.responsible?.trim() || !d.reason.trim())) throw new BadRequestException('La cuenta funcional requiere responsable titular y justificación.');
  if (d.operation !== 'create' && !d.reason.trim()) throw new BadRequestException('Describe los cambios o el motivo de la baja.');
  if (d.operation !== 'create' || d.kind === 'alias') {
    if (!corporateEmail(d.existingEmail ?? '')) throw new BadRequestException('Indica el correo institucional existente.');
    if (d.kind === 'alias' && d.operation === 'create' && d.existingEmail!.endsWith('@' + DOMAINS[d.company])) throw new BadRequestException('El alias debe pertenecer al segundo dominio; conserva la cuenta principal existente.');
    if (d.operation !== 'create' && !d.existingEmail!.endsWith('@'+DOMAINS[d.company])) throw new BadRequestException('El correo existente debe corresponder a la empresa seleccionada.');
  }
  if (d.operation !== 'offboard' && (d.kind === 'temporary' || d.expiresOn)) {
    const today = new Date().toISOString().slice(0,10);
    if (!d.expiresOn || !validDate(d.expiresOn) || d.expiresOn < d.startsOn || d.expiresOn <= today) throw new BadRequestException('El vencimiento debe ser posterior a hoy y no anterior al ingreso.');
  }
  return {...d, name:d.name.trim(), employeeId:d.employeeId.trim(), area:d.area.trim(), jobTitle:d.jobTitle.trim(),
    groups:d.groups.trim(), reason:d.reason.trim(), responsible:d.kind==='functional'?d.responsible?.trim():undefined,
    existingEmail:d.operation!=='create'||d.kind==='alias'?d.existingEmail:undefined, domain: DOMAINS[d.company]};
}
export function canReadRequest(r: any, u: MailActor) {
  return managesMail(u) || Number(r.requester_id) === u.sub || (Number(r.manager_id) === u.sub && approvesMail(u));
}
export function nextStatus(r: any, u: MailActor, action: string, note = '') {
  const manager = Number(r.manager_id) === u.sub && Number(r.requester_id) !== u.sub && approvesMail(u);
  const ti = managesMail(u);
  if (['observe','reject'].includes(action) && !note.trim()) throw new BadRequestException('Escribe un motivo para el solicitante.');
  if (r.status === 'approval' && manager) {
    if (action === 'approve') return 'validation';
    if (action === 'observe') return 'observed';
    if (action === 'reject') return 'rejected';
  }
  if (ti && ['validation','creating'].includes(r.status)) {
    if (action === 'observe') return 'observed';
    if (action === 'reject') return 'rejected';
    if (action === 'start' && r.status === 'validation') return 'creating';
    if (action === 'complete' && r.status === 'creating') return 'delivered';
  }
  throw new ForbiddenException('No puedes realizar esta acción en el estado actual.');
}
