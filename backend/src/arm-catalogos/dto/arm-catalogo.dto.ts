import {
  IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const ARM_CATALOGO_TIPOS = ['asistencia', 'voluntarios', 'moneda'] as const;
export type ArmCatalogoTipo = typeof ARM_CATALOGO_TIPOS[number];

export class CreateArmCatalogoDto {
  @ApiProperty({ enum: ARM_CATALOGO_TIPOS })
  @IsIn(ARM_CATALOGO_TIPOS)
  tipo: ArmCatalogoTipo;

  /** Valor estable escrito en encuentros.asistencia / .voluntarios / siembra.montos[].moneda — inmutable tras crear. */
  @ApiProperty()
  @IsNotEmpty() @IsString() @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'key solo puede contener letras, números y guion bajo' })
  key: string;

  @ApiProperty()
  @IsNotEmpty() @IsString() @MaxLength(150)
  label: string;

  @ApiProperty() @IsOptional() @IsInt()
  sortOrder?: number;
}

export class UpdateArmCatalogoDto {
  // Nota: `key` y `tipo` son inmutables — no se aceptan en update (ValidationPipe con
  // forbidNonWhitelisted rechaza cualquier intento de enviarlos).
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)
  label?: string;

  @ApiProperty() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiProperty() @IsOptional() @IsInt()
  sortOrder?: number;
}
