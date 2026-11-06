export type MailDetails = {
  operation: 'create'|'change'|'offboard'; company:'arm'|'school'; kind:string;
  name:string;employeeId:string;area:string;jobTitle:string;startsOn:string;suggestedName:string;
  groups:string;reason:string;expiresOn?:string;existingEmail?:string;responsible?:string;domain?:string;
};
export type Options = {canManage:boolean;canApprove:boolean;dueReviews:number;managers:{id:number;name:string}[]};
export type RequestSummary = {id:string;name:string;company:string;operation:string;kind:string;domain:string;status:string;created_at:string;version:number};
export type MailRequest = {id:string;version:number;status:string;details:MailDetails;manager_id:string;requester_name:string;manager_name:string;assignee_name:string;assigned_to:string|null;canApprove:boolean;canRevise:boolean;canManage:boolean;
  events:{id:string;action:string;note:string;actor_name:string;created_at:string;snapshot:Record<string,unknown>}[]};
export const statusNames:Record<string,string>={approval:'Aprobación pendiente',validation:'Validación TI',creating:'En ejecución',observed:'Con observaciones',delivered:'Completada / entregada',rejected:'Rechazada'};
export const operationNames:Record<string,string>={create:'Solicitud de correo',change:'Cambio de correo / accesos',offboard:'Baja de colaborador'};
export const kindNames:Record<string,string>={collaborator:'Colaborador',temporary:'Temporal',functional:'Cuenta funcional',alias:'Alias · sin licencia adicional'};
export const domains={arm:'armglobal.org',school:'arschoolglobal.com'};
export const dateLabel=(value:string)=>new Date(value).toLocaleString('es-CL',{dateStyle:'medium',timeStyle:'short'});
