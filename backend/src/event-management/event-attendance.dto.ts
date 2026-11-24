import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';

/** Lo que lee el escáner o se escribe a mano en la puerta: el código de la entrada. */
export class CheckInDto {
 @IsString() @MinLength(1) @MaxLength(300) code:string;
}
/** Inscripción agregada por el equipo (cortesías, staff, pago en efectivo). Siempre queda confirmada y sin cobro. */
export class ManualRegistrationDto {
 @IsString() @MinLength(1) @MaxLength(80) firstName:string;
 @IsString() @MinLength(1) @MaxLength(80) lastName:string;
 @IsEmail() @MaxLength(254) email:string;
 @IsOptional() @Matches(/^\+?[0-9 ()-]{7,25}$/) phone?:string;
 @IsInt() @Min(1) campusId:number;
 @IsOptional() @IsUUID() ticketTypeId?:string;
 @IsOptional() @IsString() @MaxLength(300) note?:string;
 @IsBoolean() sendEmail:boolean;
}
