import { IsString, IsOptional, IsNumber, Min, IsNotEmpty } from 'class-validator';

export class CreateKiloamorDto {
  @IsOptional() @IsString() @IsNotEmpty() idempotencyKey?: string;

  @IsString() @IsNotEmpty() campus: string;
  @IsString() @IsNotEmpty() fecha: string;

  @IsOptional() @IsNumber() @Min(0) cajas?: number;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellido?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() observaciones?: string;
}

export class UpdateKiloamorDto {
  @IsOptional() @IsString() fecha?: string;
  @IsOptional() @IsNumber() @Min(0) cajas?: number;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() apellido?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() observaciones?: string;
}
