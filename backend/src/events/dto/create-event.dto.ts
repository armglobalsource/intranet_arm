import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum EventCategory {
  ENCUENTRO     = 'encuentro',
  CONFERENCIA   = 'conferencia',
  EVENTO_ESP    = 'evento_especial',
  ADN           = 'adn',
  EVENTO_SOCIAL = 'evento_social',
  AMOR_CASA     = 'amor_casa',
  PERSONALIZADO = 'personalizado',
  // legacy — mantenidos para datos existentes
  CULTO         = 'culto',
  RETIRO        = 'retiro',
  CAPACITACION  = 'capacitacion',
  SOCIAL        = 'social',
  OTRO          = 'otro',
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Fecha de inicio — formato ISO "YYYY-MM-DD" */
  @IsDateString()
  date: string;

  /** Fecha de fin (opcional, para eventos multi-día) */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Hora en formato "HH:MM" (24h) */
  @IsOptional()
  @IsString()
  time?: string;

  @IsEnum(EventCategory)
  category: EventCategory;

  /** Etiqueta personalizada (cuando category = 'personalizado') */
  @IsOptional()
  @IsString()
  customLabel?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
