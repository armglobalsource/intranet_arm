import {
  ArrayMaxSize, IsString, IsOptional, IsIn, IsArray, ValidateNested,
  IsBoolean, IsNumber, IsObject, IsDateString, IsNotEmpty, MaxLength,
  Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

const SECTION_NAMES = [
  'pastoral', 'escena', 'produccion', 'media', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit',
] as const;
const LAYOUT_SLOTS = ['pastoral', 'produccion', 'media', 'streaming', 'horarios', 'worship', 'voluntarios', 'anuncios'] as const;

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

  // Proporción del ancho de la columna izquierda (0.2–0.8). Default: 0.5 (50/50)
  @IsOptional() @IsNumber() @Min(0.2) @Max(0.8)
  leftRatio?: number;
}

export class UpdateFichaDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) title?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsIn(SECTION_NAMES, { each: true })
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

// ── Layout Visual ────────────────────────────────────────────────────────────
// Vista alternativa de la ficha (píldora "Layout Visual" en la barra de tabs).
// Una fila por canción del Set List. Se persiste como campo top-level
// ficha.layoutVisual (NO es una Section, no participa en hiddenSections).

export class LayoutVisualSongDto {
  /** Debe coincidir con el row.id de sections.setList.rows para el sync. */
  @IsString() @IsNotEmpty() @MaxLength(80)
  songRowId: string;

  /** Texto libre: "AZUL", "LILA + NARANJO + BLANCO", etc. */
  @IsOptional() @IsString() @MaxLength(500)
  iluminacion?: string;

  /** Descripción de qué visuales usar. Puede incluir URL de Drive. */
  @IsOptional() @IsString() @MaxLength(2000)
  visualDescription?: string;

  /** IDs de referencias visuales del catálogo global (visual_references). */
  @IsOptional() @IsArray() @ArrayMaxSize(50)
  @IsNumber({}, { each: true })
  referenceIds?: number[];
}

export class UpdateLayoutVisualDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => LayoutVisualSongDto)
  songs: LayoutVisualSongDto[];
}
