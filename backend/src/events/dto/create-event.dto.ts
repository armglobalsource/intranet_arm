import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum EventCategory {
  CULTO        = 'culto',
  CONFERENCIA  = 'conferencia',
  RETIRO       = 'retiro',
  CAPACITACION = 'capacitacion',
  SOCIAL       = 'social',
  OTRO         = 'otro',
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

  @IsOptional()
  @IsString()
  location?: string;
}
