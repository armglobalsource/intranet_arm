import {
  ArrayMaxSize, ArrayMinSize, IsString, IsOptional, IsIn, IsArray, ValidateNested,
  IsBoolean, IsNumber, IsObject, IsDateString, IsNotEmpty, MaxLength,
  Min, Max, Matches,
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

/** En una edición, un encuentro nuevo puede copiar los valores de otro existente. */
export class EncuentroUpdateDto extends EncuentroDto {
  @IsOptional() @IsString() @MaxLength(40) copyFrom?: string;
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
  // LAYOUT_SLOTS tiene 8 valores posibles — una columna podría en teoría
  // contener todos (usuario mueve todo a un lado), así que el máximo debe
  // ser 8, no 7 (con 7 se rechazaba silenciosamente ese caso límite).
  @IsArray() @ArrayMaxSize(LAYOUT_SLOTS.length) @IsIn(LAYOUT_SLOTS, { each: true })
  left: string[];

  @IsArray() @ArrayMaxSize(LAYOUT_SLOTS.length) @IsIn(LAYOUT_SLOTS, { each: true })
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
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => EncuentroUpdateDto)
  encuentros?: EncuentroUpdateDto[];
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
  /** Horarios: id del momento principal del que esta fila es un sub-momento. */
  @IsOptional() @IsString() @MaxLength(80) parentId?: string | null;
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

  /**
   * Swatches de color (hex #RRGGBB) que representan la paleta de luces
   * de la canción. Se muestran al lado del texto de iluminación como
   * referencia visual rápida para el iluminador.
   */
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { each: true, message: 'Cada color debe ser un hex #RRGGBB' })
  illuminationColors?: string[];

  /** Descripción de qué visuales usar. Puede incluir URL de Drive. */
  @IsOptional() @IsString() @MaxLength(2000)
  visualDescription?: string;

  /** IDs de referencias visuales del catálogo global (visual_references). */
  @IsOptional() @IsArray() @ArrayMaxSize(50)
  @IsNumber({}, { each: true })
  referenceIds?: number[];
}

/**
 * Un "slot" del layout visual: para fichas multi-encuentro se separan en
 * AM y PM (por hora del encuentro); para fichas de 1 encuentro (unico /
 * oracion) hay un solo slot con id='default'.
 */
export class LayoutVisualSlotDto {
  /** 'default' | 'am' | 'pm' */
  @IsString() @IsNotEmpty() @MaxLength(20)
  id: string;

  /** '' | 'AM' | 'PM' — etiqueta legible */
  @IsOptional() @IsString() @MaxLength(20)
  label?: string;

  /** IDs de encuentros que este slot cubre. */
  @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(50, { each: true })
  encuentroIds: string[];

  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => LayoutVisualSongDto)
  songs: LayoutVisualSongDto[];

  @IsOptional() @IsString() @MaxLength(50000)
  producerNotes?: string;
}

/**
 * Update del layout visual. Acepta la nueva forma con `slots[]` (fichas
 * multi-encuentro pueden mandar 2 slots: am/pm). También acepta la forma
 * legacy con `songs[]` + `producerNotes` a nivel raíz — el service la
 * normaliza a un solo slot 'default'.
 */
export class UpdateLayoutVisualDto {
  /** Nueva forma: arreglo de slots. */
  @IsOptional() @IsArray() @ArrayMaxSize(5)
  @ValidateNested({ each: true }) @Type(() => LayoutVisualSlotDto)
  slots?: LayoutVisualSlotDto[];

  /** Legacy: canciones a nivel raíz (equivalente a slot 'default'). */
  @IsOptional() @IsArray() @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => LayoutVisualSongDto)
  songs?: LayoutVisualSongDto[];

  /**
   * Notas del productor en HTML (rich text). Solo aplica en modo legacy;
   * en el modo slots, cada slot tiene sus propias notas.
   */
  @IsOptional() @IsString() @MaxLength(50000)
  producerNotes?: string;
}
