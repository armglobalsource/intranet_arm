import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAnuncioDto {
  @IsString() @IsNotEmpty() titulo: string;
  @IsString() @IsNotEmpty() texto: string;

  /** Campus destino, o 'todos'. Default: 'todos'. */
  @IsOptional() @IsString() campus?: string;

  /** Fecha de vencimiento ('YYYY-MM-DD') o vacío. */
  @IsOptional() @IsString() vence?: string;
}

export class UpdateAnuncioDto {
  @IsOptional() @IsString() @IsNotEmpty() titulo?: string;
  @IsOptional() @IsString() @IsNotEmpty() texto?: string;
  @IsOptional() @IsString() campus?: string;
  @IsOptional() @IsString() vence?: string;
}
