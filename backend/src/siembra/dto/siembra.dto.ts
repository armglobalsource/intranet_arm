import {
  IsString, IsOptional, IsNumber, Min, IsNotEmpty, IsArray, ArrayMinSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// El total de cada línea (sumup + efectivo + diezmo) lo calcula el servidor.
export class MontoDto {
  @IsString() @IsNotEmpty() moneda: string;
  @IsOptional() @IsNumber() @Min(0) sumup?: number;   // total tarjeta (SumUp)
  @IsOptional() @IsNumber() @Min(0) efectivo?: number;
  @IsOptional() @IsNumber() @Min(0) diezmo?: number;
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
