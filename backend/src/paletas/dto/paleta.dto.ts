import { IsString, IsArray, IsNumber, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ColorDto {
  @IsString() name: string;
  @IsString() hex:  string;
}

export class CreatePaletaDto {
  @IsString()  name: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorDto)
  colors: ColorDto[];
  // id, order y active los asigna el servicio automáticamente
}

export class UpdatePaletaDto {
  @IsOptional() @IsString()  name?:   string;
  @IsOptional() @IsArray()   colors?: ColorDto[];
  @IsOptional() @IsNumber()  order?:  number;
  @IsOptional() @IsBoolean() active?: boolean;
}
