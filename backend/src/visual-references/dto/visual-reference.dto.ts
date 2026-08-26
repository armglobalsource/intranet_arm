import {
  IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para el metadata que acompaña al upload (POST). El file va como multipart
 * separado (FileInterceptor); estos campos vienen del mismo form-data.
 */
export class CreateVisualReferenceDto {
  @ApiProperty({ example: 'Azul frío — Worship' })
  @IsNotEmpty() @IsString() @MaxLength(150)
  name: string;

  /**
   * Tags separados por coma en el form-data (más fácil desde HTML form que enviar
   * un array). El service parsea y normaliza (trim + lowercase).
   */
  @ApiProperty({ example: 'azul,worship,particulas' })
  @IsOptional() @IsString() @MaxLength(500)
  tags?: string;
}

/** Update: sin cambiar la imagen. Para reemplazar la imagen, borrar + subir de nuevo. */
export class UpdateVisualReferenceDto {
  @ApiProperty() @IsOptional() @IsString() @MaxLength(150)
  name?: string;

  @ApiProperty() @IsOptional() @IsString() @MaxLength(500)
  tags?: string;

  @ApiProperty() @IsOptional() @IsBoolean()
  isActive?: boolean;
}
