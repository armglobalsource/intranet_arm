import { IsString, IsOptional } from 'class-validator';

export class UpsertCancionDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() tonalidad?: string;
}
