import {
  IsString, IsOptional, IsIn, IsInt, Max, Min, ValidateNested, IsNotEmpty, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Sub-objetos (todos los conteos opcionales; faltantes = 0) ────────────────

export class PresencialDto {
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) acepto?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) total?: number;
}

export class OnlineDto {
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) acepto?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) espectadores?: number;
}

export class AsistenciaDto {
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) auditorio?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) kids?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) tweens?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) bebe?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) sensorial?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) cambios?: number;
}

export class VoluntariosDto {
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) oradores?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) servicio?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) tecnica?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) kids?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) tweens?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) worship?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) cocina?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) rrss?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) seguridad?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) sala_bebes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) conexion?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) info?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) proyecto_educativo?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) oracion?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) merch?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) amor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) sensorial?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) siembra?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) cambios?: number;
}

// ── DTO principal ────────────────────────────────────────────────────────────
// Nota: los totales (totalAsistencia / totalVoluntarios) y la metadata de
// trazabilidad (registradoPor, fechaRegistro, etc.) los calcula/asigna el
// servidor — NO se aceptan del cliente.

export class CreateEncuentroDto {
  /** Clave de idempotencia generada en el cliente (cola offline) — evita duplicados al reintentar el envío. */
  @IsOptional() @IsString() @IsNotEmpty()
  idempotencyKey?: string;

  @IsIn(['encuentro', 'evento'])
  tipo: 'encuentro' | 'evento';

  @IsString() @IsNotEmpty()
  campus: string;

  @IsString() @IsNotEmpty()
  fecha: string; // fecha del encuentro ('YYYY-MM-DD' o ISO)

  @IsOptional() @IsString() encuentro?: string;   // etiqueta ("Encuentro I · 9:00")
  @IsOptional() @IsString() modalidad?: string;
  @IsOptional() @IsString() predicador?: string;
  @IsOptional() @IsString() mensaje?: string;
  @IsOptional() @IsString() lideres?: string;
  @IsOptional() @IsString() adm?: string;

  // Solo cuando tipo === 'evento'
  @IsOptional() @IsString() eventoNombre?: string;
  @IsOptional() @IsString() eventoDesc?: string;
  @IsOptional() @IsString() eventoHorario?: string;

  @IsOptional() @ValidateNested() @Type(() => PresencialDto)
  presencial?: PresencialDto;

  @IsOptional() @ValidateNested() @Type(() => OnlineDto)
  online?: OnlineDto;

  @IsOptional() @ValidateNested() @Type(() => AsistenciaDto)
  asistencia?: AsistenciaDto;

  @IsOptional() @ValidateNested() @Type(() => VoluntariosDto)
  voluntarios?: VoluntariosDto;
}

export class ObservarEncuentroDto {
  @IsString() @IsNotEmpty() @MaxLength(500) observacion: string;
}

export class UpdateEncuentroDto {
  @IsOptional() @IsString() fecha?: string;
  @IsOptional() @IsString() encuentro?: string;
  @IsOptional() @IsString() modalidad?: string;
  @IsOptional() @IsString() predicador?: string;
  @IsOptional() @IsString() mensaje?: string;
  @IsOptional() @IsString() lideres?: string;
  @IsOptional() @IsString() adm?: string;
  @IsOptional() @IsString() eventoNombre?: string;
  @IsOptional() @IsString() eventoDesc?: string;
  @IsOptional() @IsString() eventoHorario?: string;

  @IsOptional() @ValidateNested() @Type(() => PresencialDto)
  presencial?: PresencialDto;

  @IsOptional() @ValidateNested() @Type(() => OnlineDto)
  online?: OnlineDto;

  @IsOptional() @ValidateNested() @Type(() => AsistenciaDto)
  asistencia?: AsistenciaDto;

  @IsOptional() @ValidateNested() @Type(() => VoluntariosDto)
  voluntarios?: VoluntariosDto;
}
