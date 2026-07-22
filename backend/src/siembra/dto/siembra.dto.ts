import {
  IsString, IsOptional, IsNumber, Min, IsNotEmpty, IsArray, ArrayMinSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Una fila individual de diezmo u "otro aporte" (nombre + monto), como se registra en el Excel de campus.
export class AporteDto {
  @IsOptional() @IsString() nombre?: string;
  @IsNumber() @Min(0) monto: number;
  @IsOptional() @IsString() nota?: string; // ej: "VZLA", "Misiones" — solo aplica a otrosAportes
}

// Un método de pago (Efectivo/Sobres o SumUp) dentro de una moneda.
// Los totales (diezmos, otrosAportes, total) los calcula el servidor.
export class MetodoPagoDto {
  @IsOptional() @IsNumber() @Min(0) ofrendas?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AporteDto)
  diezmos?: AporteDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AporteDto)
  otrosAportes?: AporteDto[];
}

export class MontoDto {
  @IsString() @IsNotEmpty() moneda: string;

  @IsOptional() @ValidateNested() @Type(() => MetodoPagoDto)
  efectivo?: MetodoPagoDto;

  @IsOptional() @ValidateNested() @Type(() => MetodoPagoDto)
  sumup?: MetodoPagoDto;
}

export class CreateSiembraDto {
  @IsOptional() @IsString() @IsNotEmpty() idempotencyKey?: string;

  @IsString() @IsNotEmpty() campus: string;
  @IsString() @IsNotEmpty() fecha: string;

  @IsOptional() @IsString() encuentro?: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => MontoDto)
  montos: MontoDto[];

  @IsOptional() @IsString() observaciones?: string;
}

export class UpdateSiembraDto {
  @IsOptional() @IsString() fecha?: string;
  @IsOptional() @IsString() encuentro?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MontoDto)
  montos?: MontoDto[];

  @IsOptional() @IsString() observaciones?: string;
}
