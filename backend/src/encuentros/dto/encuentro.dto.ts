import {
  IsString, IsOptional, IsIn, IsNumber, Min, ValidateNested, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Sub-objetos (todos los conteos opcionales; faltantes = 0) ────────────────

export class PresencialDto {
  @IsOptional() @IsNumber() @Min(0) acepto?: number;
  @IsOptional() @IsNumber() @Min(0) total?: number;
}

export class OnlineDto {
  @IsOptional() @IsNumber() @Min(0) acepto?: number;
  @IsOptional() @IsNumber() @Min(0) espectadores?: number;
}

export class AsistenciaDto {
  @IsOptional() @IsNumber() @Min(0) auditorio?: number;
  @IsOptional() @IsNumber() @Min(0) kids?: number;
  @IsOptional() @IsNumber() @Min(0) tweens?: number;
  @IsOptional() @IsNumber() @Min(0) bebe?: number;
  @IsOptional() @IsNumber() @Min(0) sensorial?: number;
  @IsOptional() @IsNumber() @Min(0) cambios?: number;
}

export class VoluntariosDto {
  @IsOptional() @IsNumber() @Min(0) servicio?: number;
  @IsOptional() @IsNumber() @Min(0) tecnica?: number;
  @IsOptional() @IsNumber() @Min(0) kids?: number;
  @IsOptional() @IsNumber() @Min(0) tweens?: number;
  @IsOptional() @IsNumber() @Min(0) worship?: number;
  @IsOptional() @IsNumber() @Min(0) cocina?: number;
  @IsOptional() @IsNumber() @Min(0) rrss?: number;
  @IsOptional() @IsNumber() @Min(0) seguridad?: number;
  @IsOptional() @IsNumber() @Min(0) sala_bebes?: number;
  @IsOptional() @IsNumber() @Min(0) conexion?: number;
  @IsOptional() @IsNumber() @Min(0) oracion?: number;
  @IsOptional() @IsNumber() @Min(0) merch?: number;
  @IsOptional() @IsNumber() @Min(0) amor?: number;
  @IsOptional() @IsNumber() @Min(0) sensorial?: number;
  @IsOptional() @IsNumber() @Min(0) siembra?: number;
  @IsOptional() @IsNumber() @Min(0) cambios?: number;
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
