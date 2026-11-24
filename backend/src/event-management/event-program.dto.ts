import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class EventCategoryDto {
 @IsString() @MinLength(1) @MaxLength(80) name: string;
 @IsBoolean() active: boolean;
}
export class EventFaqDto {
 @IsString() @MinLength(1) @MaxLength(200) question: string;
 @IsString() @MinLength(1) @MaxLength(2000) answer: string;
}
export class EventTicketTypeDto {
 /** Presente al editar un tipo existente: conserva sus ventas y sus códigos. */
 @IsOptional() @IsUUID() id?: string;
 @IsString() @MinLength(1) @MaxLength(80) name: string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(999999999) price: number;
 @IsString() @Matches(/^[A-Z]{3}$/) currency: string;
 @IsOptional() @IsString() @MaxLength(300) description?: string;
 @IsOptional() @IsInt() @Min(1) @Max(1000000) capacity?: number | null;
 @IsOptional() @IsISO8601({strict:true}) salesStart?: string | null;
 @IsOptional() @IsISO8601({strict:true}) salesEnd?: string | null;
 @IsOptional() @IsBoolean() hidden?: boolean;
 @IsOptional() @IsInt() @Min(1) @Max(10) maxPerOrder?: number;
}
/** Pregunta que responde cada asistente al inscribirse. */
export class EventQuestionDto {
 @Matches(/^[a-z0-9]{4,16}$/) id: string;
 @IsString() @MinLength(1) @MaxLength(200) label: string;
 @IsIn(['text','select','yesno']) type: 'text'|'select'|'yesno';
 @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) options?: string[];
 @IsBoolean() required: boolean;
}
/** Código de descuento o de acceso a entradas ocultas (descuento 0). */
export class EventDiscountCodeDto {
 @Matches(/^[A-Za-z0-9_-]{3,30}$/,{message:'El código usa de 3 a 30 letras, números, guiones o guiones bajos'}) code: string;
 @IsIn(['percent','amount']) kind: 'percent'|'amount';
 @IsNumber({maxDecimalPlaces:0}) @Min(0) @Max(999999999) value: number;
 @IsOptional() @IsInt() @Min(1) @Max(1000000) maxUses?: number | null;
 @IsOptional() @IsISO8601({strict:true}) startsAt?: string | null;
 @IsOptional() @IsISO8601({strict:true}) endsAt?: string | null;
 @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all',{each:true}) ticketTypeIds: string[];
 @IsBoolean() active: boolean;
}
export class EventDetailsDto {
 @IsString() @MaxLength(240) summary: string;
 @IsString() @MaxLength(15000) description: string;
 @IsString() @MaxLength(2000) bannerUrl: string;
 @Matches(/^#[0-9a-fA-F]{6}$/) color: string;
 @IsString() @MaxLength(80) timezone: string;
 @IsIn(['onsite','online','hybrid']) modality: string;
 @IsString() @MaxLength(200) location: string;
 @IsString() @MaxLength(400) address: string;
 @IsOptional() @IsISO8601({strict:true}) registrationOpensAt?: string | null;
 @IsOptional() @IsISO8601({strict:true}) registrationClosesAt?: string | null;
 @IsOptional() @IsISO8601({strict:true}) paymentDueAt?: string | null;
 @IsBoolean() waitlist: boolean;
 @IsOptional() @IsInt() @Min(0) @Max(120) minimumAge?: number | null;
 @IsString() @MaxLength(5000) conditions: string;
 @IsString() @MaxLength(5000) cancellationPolicy: string;
 @IsIn(['free','paid']) pricing: string;
 @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>EventFaqDto) faqs: EventFaqDto[];
 @IsOptional() @IsArray() @ArrayMaxSize(15) @ValidateNested({each:true}) @Type(()=>EventQuestionDto) questions?: EventQuestionDto[];
 /** Autogestión de quien compra: transferir o cancelar sus entradas hasta cierto número de horas antes. */
 @IsOptional() @IsBoolean() selfTransfer?: boolean;
 @IsOptional() @IsBoolean() selfCancel?: boolean;
 @IsOptional() @IsInt() @Min(0) @Max(720) selfServiceHours?: number;
 /** Recordatorios automáticos una semana y un día antes. */
 @IsOptional() @IsBoolean() reminders?: boolean;
 /** Remitente de los correos del evento, p. ej. «AR Hombres» y arhombres@armglobal.org (mismo dominio verificado). */
 @IsOptional() @IsString() @MaxLength(80) senderName?: string;
 @IsOptional() @IsString() @MaxLength(254) @Matches(/^$|^[A-Za-z0-9._%+-]+@armglobal\.org$/i,{message:'El correo remitente debe ser una dirección @armglobal.org'}) senderEmail?: string;
}
/** Full replacement plus optimistic version: omitted fields cannot survive unnoticed. */
export class SaveEventProgramDto {
 @IsInt() @Min(0) version: number;
 @IsString() @MinLength(1) @MaxLength(160) title: string;
 @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(120) slug: string;
 @IsOptional() @IsUUID() categoryId?: string | null;
 @IsInt() @Min(1) campusId: number;
 @IsInt() @Min(1) organizerId: number;
 @IsISO8601({strict:true}) startsAt: string;
 @IsISO8601({strict:true}) endsAt: string;
 @IsIn(['draft','published','finished','cancelled']) status: string;
 @IsIn(['pending','open','closed']) registrationStatus: string;
 @IsOptional() @IsInt() @Min(1) @Max(1000000) capacity?: number | null;
 @IsArray() @ArrayUnique() @ArrayMaxSize(200) @IsInt({each:true}) @Min(1,{each:true}) campusIds: number[];
 @ValidateNested() @Type(()=>EventDetailsDto) details: EventDetailsDto;
 @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>EventTicketTypeDto) ticketTypes: EventTicketTypeDto[];
}
