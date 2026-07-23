import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min,
} from 'class-validator';

// Categorías de rotación soportadas — cada una tiene su propio roster/equipos/calendario
// independiente por campus, reutilizando exactamente el mismo modelo y flujo.
export const CAMPUS_TURNO_TIPOS = ['administradores', 'lideres_voluntarios'] as const;
export type CampusTurnoTipo = typeof CAMPUS_TURNO_TIPOS[number];

// Modalidad opcional: permite que un mismo tipo (ej. lideres_voluntarios) tenga dos
// rotaciones independientes en paralelo dentro de la misma semana — AM (que cubre
// ambos encuentros del Miércoles (06:00 y 20:00) + Domingo AM como un solo equipo)
// y PM (Domingo PM). `administradores`
// no usa modalidad (queda undefined/null, tratado como una sola rotación).
export const MODALIDADES = ['AM', 'PM'] as const;
export type Modalidad = typeof MODALIDADES[number];

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
  @IsOptional() @IsIn(MODALIDADES) modalidad?: Modalidad;
}

export class UpdateEquipoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) administradorIds?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(MODALIDADES) modalidad?: Modalidad;
}

// El orden de equipoIds define la rotación (equipo[0] la primera semana, equipo[1] la siguiente, etc).
// `modalidad` genera una rotación paralela e independiente para esa fecha+campus+tipo
// (no pisa la rotación de la otra modalidad ni la de tipos/modalidad sin especificar).
export class GenerarCalendarioDto {
  @IsInt() campusId: number;
  @IsIn(CAMPUS_TURNO_TIPOS) tipo: CampusTurnoTipo;
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) equipoIds: number[];
  @IsDateString() fechaInicio: string; // 'YYYY-MM-DD', debe ser lunes
  @IsInt() @Min(1) semanas: number;
  @IsOptional() @IsIn(MODALIDADES) modalidad?: Modalidad;
}

export class UpdateTurnoDto {
  @IsInt() equipoId: number;
}
