import {
  IsString, IsOptional, MinLength, MaxLength,
  IsEnum, IsBoolean, IsArray, ValidateNested, IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MediaItemDto {
  @ApiProperty() @IsEnum(['image', 'video', 'instagram', 'youtube']) type: string;
  @ApiProperty() @IsString() url: string;
  @ApiProperty() @IsOptional() @IsString() caption?: string;
}

export class CreateContentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(255) title: string;
  @ApiProperty() @IsString() body: string;
  @ApiProperty() @IsOptional() @IsString() excerpt?: string;
  @ApiProperty() @IsOptional() @IsEnum(['news', 'page', 'announcement']) type?: string;
  @ApiProperty() @IsOptional() @IsBoolean() pinned?: boolean;
  /** null = global, string = campusId específico */
  @ApiProperty() @IsOptional() @IsString() campusId?: string | null;
  @ApiProperty() @IsOptional() @IsEnum(['draft', 'published']) status?: string;
  /** URL de imagen de portada */
  @ApiProperty() @IsOptional() @IsString() imageUrl?: string;
  /** URL de video YouTube/Vimeo */
  @ApiProperty() @IsOptional() @IsString() videoUrl?: string;
  /** URL de post de Instagram */
  @ApiProperty() @IsOptional() @IsString() instagramUrl?: string;
  /** Media adicional (imágenes, videos, instagram) */
  @ApiProperty({ type: [MediaItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MediaItemDto)
  mediaItems?: MediaItemDto[];
}
