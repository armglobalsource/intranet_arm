import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const AUDIENCES = ['all', 'confirmed', 'checked_in', 'not_checked_in', 'pending', 'waitlisted'] as const;
export type Audience = typeof AUDIENCES[number];

/** Mensaje del equipo a los inscritos; `dryRun` solo cuenta destinatarios y `test` lo envía a quien escribe. */
export class EventMessageDto {
 @IsString() @MinLength(1) @MaxLength(150) subject: string;
 @IsString() @MinLength(1) @MaxLength(5000) body: string;
 @IsIn(AUDIENCES as unknown as string[]) audience: Audience;
 @IsOptional() @IsUUID() ticketTypeId?: string;
 @IsOptional() @IsInt() @Min(1) campusId?: number;
 @IsOptional() @IsBoolean() test?: boolean;
 @IsOptional() @IsBoolean() dryRun?: boolean;
}
export class RefundDto {
 /** true: devuelve todo lo que queda de la compra; false: solo esta entrada. */
 @IsBoolean() wholeOrder: boolean;
}
export class SurveyAccessDto {
 @Matches(/^[A-Za-z0-9_-]{4,400}$/) e: string;
 @Matches(/^[A-Za-z0-9_-]{20,100}$/) t: string;
}
export class SurveyAnswerDto extends SurveyAccessDto {
 @IsInt() @Min(1) @Max(5) rating: number;
 @IsOptional() @IsInt() @Min(0) @Max(10) nps?: number;
 @IsOptional() @IsString() @MaxLength(1000) liked?: string;
 @IsOptional() @IsString() @MaxLength(1000) improve?: string;
 @IsOptional() @IsString() @MaxLength(1000) extra?: string;
}
