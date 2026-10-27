import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class UpsertCancionDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() tonalidad?: string;
}

/** Edición explícita del catálogo compartido; version evita pisar otra edición. */
export class UpdateCancionDto {
  @IsString() @MaxLength(20) tonalidad: string;
  @IsString() @MaxLength(30000) letra: string;
  @IsOptional() @IsDateString() expectedUpdatedAt?: string | null;
}
