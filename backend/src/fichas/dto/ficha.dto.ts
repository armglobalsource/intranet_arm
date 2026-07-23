import {
  ArrayMaxSize, IsString, IsOptional, IsIn, IsArray, ValidateNested,
  IsBoolean, IsNumber, IsObject, IsDateString, IsNotEmpty, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const SECTION_NAMES = [
  'pastoral', 'escena', 'produccion', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit',
] as const;
const LAYOUT_SLOTS = ['pastoral', 'produccion', 'streaming', 'horarios', 'worship', 'voluntarios', 'anuncios'] as const;

export class EncuentroDto {
  @IsString() @IsNotEmpty() @MaxLength(40) id: string;
  @IsString() @IsNotEmpty() @MaxLength(120) label: string;
  @IsString() @IsNotEmpty() @MaxLength(10) time: string;
  @IsBoolean() isLive: boolean;
  @IsString() @MaxLength(30) color: string;
}

export class CreateFichaDto {
  @IsString() @IsNotEmpty() @MaxLength(80) campusId: string;
  @IsString() @IsNotEmpty() @MaxLength(120) campusName: string;
  @IsIn(['unico', 'multi', 'oracion']) type: 'unico' | 'multi' | 'oracion';
  @IsString() @IsNotEmpty() @MaxLength(160) title: string;
  @IsDateString() date: string;
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => EncuentroDto)
  encuentros: EncuentroDto[];
  @IsOptional() @IsString() @MaxLength(1000) descripcion?: string;
  @IsOptional() @IsString() @MaxLength(200) ubicacion?: string;
}

export class SectionLayoutDto {
  @IsArray() @ArrayMaxSize(7) @IsIn(LAYOUT_SLOTS, { each: true })
  left: string[];

  @IsArray() @ArrayMaxSize(7) @IsIn(LAYOUT_SLOTS, { each: true })
  right: string[];
}

export class UpdateFichaDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) title?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(9) @IsIn(SECTION_NAMES, { each: true })
  hiddenSections?: string[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => SectionLayoutDto)
  sectionLayout?: SectionLayoutDto;
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
  @IsString() @IsNotEmpty() @MaxLength(80) id: string;
  @IsString() @IsNotEmpty() @MaxLength(160) label: string;
  @IsIn(['text', 'person', 'song']) type: 'text' | 'person' | 'song';
  @IsBoolean() shared: boolean;
  @IsObject()  values: Record<string, string>;
  @IsNumber()  order: number;
  @IsBoolean() required: boolean;
}

export class UpdateSectionDto {
  @IsOptional() @IsNumber() expectedRevision?: number;
  @IsOptional() @IsNumber() assignedTo?: number | null;
  @IsOptional() @IsString() assignedName?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RowDto)
  rows?: RowDto[];
}
