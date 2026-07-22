import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min,
} from 'class-validator';

export class CreateAdministradorDto {
  @IsInt() campusId: number;
  @IsNotEmpty() @IsString() nombre: string;
}

export class UpdateAdministradorDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateEquipoDto {
  @IsInt() campusId: number;
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
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) equipoIds: number[];
  @IsDateString() fechaInicio: string; // 'YYYY-MM-DD', debe ser lunes
  @IsInt() @Min(1) semanas: number;
}

export class UpdateTurnoDto {
  @IsInt() equipoId: number;
}
