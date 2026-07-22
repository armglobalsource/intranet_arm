import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min,
} from 'class-validator';

// Categorías de rotación soportadas — cada una tiene su propio roster/equipos/calendario
// independiente por campus, reutilizando exactamente el mismo modelo y flujo.
export const CAMPUS_TURNO_TIPOS = ['administradores', 'lideres_voluntarios'] as const;
export type CampusTurnoTipo = typeof CAMPUS_TURNO_TIPOS[number];

export class CreateAdministradorDto {
  @IsInt() campusId: number;
  @IsIn(CAMPUS_TURNO_TIPOS) tipo: CampusTurnoTipo;
  @IsNotEmpty() @IsString() nombre: string;
}

export class UpdateAdministradorDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateEquipoDto {
  @IsInt() campusId: number;
  @IsIn(CAMPUS_TURNO_TIPOS) tipo: CampusTurnoTipo;
  @IsNotEmpty() @IsString() nombre: string;
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) administradorIds: number[];
}

export class UpdateEquipoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) administradorIds?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// El orden de equipoIds define la rotación (equipo[0] la primera semana, equipo[1] la siguiente, etc).
export class GenerarCalendarioDto {
  @IsInt() campusId: number;
  @IsIn(CAMPUS_TURNO_TIPOS) tipo: CampusTurnoTipo;
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) equipoIds: number[];
  @IsDateString() fechaInicio: string; // 'YYYY-MM-DD', debe ser lunes
  @IsInt() @Min(1) semanas: number;
}

export class UpdateTurnoDto {
  @IsInt() equipoId: number;
}
