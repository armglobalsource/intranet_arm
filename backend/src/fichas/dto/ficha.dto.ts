import { IsString, IsOptional, IsIn, IsArray, ValidateNested, IsBoolean, IsNumber, IsObject, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class EncuentroDto {
  @IsString() id: string;       // 'e1' | 'e2' | 'e3' | 'unico'
  @IsString() label: string;    // "Encuentro I · 9:00"
  @IsString() time: string;     // "09:00"
  @IsBoolean() isLive: boolean;
  @IsString() color: string;    // hex o nombre
}

export class CreateFichaDto {
  @IsString() campusId: string;
  @IsString() campusName: string;
  @IsIn(['unico', 'multi', 'oracion']) type: 'unico' | 'multi' | 'oracion';
  @IsString() title: string;
  @IsString() date: string;  // ISO string
  @IsArray() @ValidateNested({ each: true }) @Type(() => EncuentroDto)
  encuentros: EncuentroDto[];
}

export class UpdateFichaDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsIn(['draft', 'in_progress', 'complete']) status?: string;
}

export class CloneFichaDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsBoolean()    keepAssignees?: boolean;
  @IsOptional() @IsString()     title?: string;
}

export class RowValueDto {
  [key: string]: string;  // { e1: 'nombre', unico: 'nombre' }
}

export class RowDto {
  @IsString()  id: string;
  @IsString()  label: string;
  @IsIn(['text', 'person', 'song']) type: 'text' | 'person' | 'song';
  @IsBoolean() shared: boolean;
  @IsObject()  values: Record<string, string>;
  @IsNumber()  order: number;
  @IsBoolean() required: boolean;
}

export class UpdateSectionDto {
  @IsOptional() @IsNumber() assignedTo?: number;
  @IsOptional() @IsString() assignedName?: string;
  @IsOptional() @IsBoolean() isCompleted?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RowDto)
  rows?: RowDto[];
}
